using System.Security.Cryptography;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Portfolio.Api.Controllers;
using Portfolio.Api.Options;
using Portfolio.Api.Services;
using Portfolio.Api.Validation;
using Portfolio.Infrastructure;
using Portfolio.Infrastructure.Persistence;
using Scalar.AspNetCore;

// One-off commands, run with: dotnet run --project src/Portfolio.Api -- <command>
//   seed           import SeedData/content-seed.json into an empty database
//   hash-password  turn your admin password into the hash for Admin:PasswordHash
//   new-jwt-key    print a random key for Jwt:Key
var command = args.FirstOrDefault(a => a is "seed" or "hash-password" or "new-jwt-key");

if (command == "hash-password")
{
    Console.Write("Admin password (at least 12 characters): ");
    var password = ReadHidden();
    if (password.Length < 12) { Console.WriteLine("Too short. Use at least 12 characters."); return; }
    Console.Write("Repeat it: ");
    if (ReadHidden() != password) { Console.WriteLine("The two passwords don't match."); return; }
    Console.WriteLine();
    Console.WriteLine(AuthController.HashPassword(password));
    return;
}
if (command == "new-jwt-key")
{
    Console.WriteLine(Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));
    return;
}

var builder = WebApplication.CreateBuilder(args.Where(a => a != command).ToArray());

builder.Services.AddInfrastructure(builder.Configuration.GetConnectionString("Default"));

// Settings
builder.Services.Configure<AdminOptions>(builder.Configuration.GetSection(AdminOptions.Section));
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection(GeminiOptions.Section));
builder.Services.Configure<TurnstileOptions>(builder.Configuration.GetSection(TurnstileOptions.Section));
builder.Services.Configure<R2Options>(builder.Configuration.GetSection(R2Options.Section));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.Section));
builder.Services.Configure<PublishOptions>(builder.Configuration.GetSection(PublishOptions.Section));

var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.Key))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Jwt:Key is not configured. Generate one with: dotnet run -- new-jwt-key");
    // Development only: a random key per run. Admin logins reset when the API restarts.
    jwt.Key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
}
if (jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");
builder.Services.Configure<JwtOptions>(o =>
{
    o.Key = jwt.Key;
    o.Issuer = jwt.Issuer;
    o.Audience = jwt.Audience;
    o.ExpiryHours = jwt.ExpiryHours;
});

// Admin authentication: a bearer token from POST /api/auth/login
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.SigningKey(jwt.Key),
            NameClaimType = "sub",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

// App services
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<MediaStorage>();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<TurnstileVerifier>(c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<EmailNotifier>(c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<DeployHook>(c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient<EchoAssistant>(c =>
{
    c.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    c.Timeout = TimeSpan.FromSeconds(25);
});
builder.Services.AddValidatorsFromAssemblyContaining<SiteContentValidator>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddOutputCache(o =>
    o.AddPolicy(ContentController.CacheTag, p => p.Expire(TimeSpan.FromMinutes(10)).Tag(ContentController.CacheTag)));

// Only the frontend may call the API from a browser
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// Per-IP limits: 100/minute overall, 5/minute for login and the request form, 15/minute for Echo
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("strict", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("echo", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

if (command == "seed")
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<ContentSeeder>();
    var path = Path.Combine(AppContext.BaseDirectory, "SeedData", "content-seed.json");
    Console.WriteLine(await seeder.SeedAsync(path));
    return;
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseOutputCache();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

static string ReadHidden()
{
    if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
    var chars = new List<char>();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); break; }
        if (key.Key == ConsoleKey.Backspace) { if (chars.Count > 0) chars.RemoveAt(chars.Count - 1); continue; }
        if (!char.IsControl(key.KeyChar)) chars.Add(key.KeyChar);
    }
    return new string([.. chars]);
}

public partial class Program { }
