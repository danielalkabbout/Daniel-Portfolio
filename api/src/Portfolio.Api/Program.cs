using System.Security.Cryptography;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Portfolio.Api.Controllers;
using Portfolio.Api.Options;
using Portfolio.Api.Services;
using Portfolio.Api.Validation;
using Portfolio.Infrastructure;
using Portfolio.Infrastructure.Persistence;
using Scalar.AspNetCore;

// One-off commands, run with: dotnet run --project src/Portfolio.Api -- <command>
//   migrate        apply database migrations, then seed if the database is empty
//   seed           import SeedData/content-seed.json into an empty database
//   create-admin   create the studio account in the database, or reset its password
//   hash-password  turn your admin password into the hash for Admin:PasswordHash
//   new-jwt-key    print a random key for Jwt:Key
var command = args.FirstOrDefault(a => a is "migrate" or "seed" or "create-admin" or "hash-password" or "new-jwt-key");

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

// Hosts like Render tell the app which port to listen on through PORT.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

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
        // A token stops working once the password changes (the account's security stamp changes).
        o.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var principal = ctx.Principal!;
                var accounts = ctx.HttpContext.RequestServices.GetRequiredService<AdminAccounts>();
                if (!int.TryParse(principal.FindFirst(TokenService.AccountIdClaim)?.Value, out var id)
                    || await accounts.FindAsync(id, ctx.HttpContext.RequestAborted) is not { } account
                    || account.SecurityStamp != principal.FindFirst(TokenService.StampClaim)?.Value)
                    ctx.Fail("This session has ended. Sign in again.");
            },
        };
    });
builder.Services.AddAuthorization();

// App services
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<AdminAccounts>();
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
var strictLimit = builder.Configuration.GetValue("RateLimits:Strict", 5);
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
            _ => new FixedWindowRateLimiterOptions { PermitLimit = strictLimit, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("echo", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

var seedPath = Path.Combine(AppContext.BaseDirectory, "SeedData", "content-seed.json");

if (command == "seed")
{
    using var scope = app.Services.CreateScope();
    Console.WriteLine(await scope.ServiceProvider.GetRequiredService<ContentSeeder>().SeedAsync(seedPath));
    return;
}

if (command == "create-admin")
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    Console.Write("Admin email: ");
    var email = AdminAccounts.Normalize(Console.ReadLine());
    if (!email.Contains('@')) { Console.WriteLine("That doesn't look like an email address."); return; }
    Console.Write($"Password (at least {AdminAccounts.MinPasswordLength} characters): ");
    var password = ReadHidden();
    if (AdminAccounts.CheckNewPassword(password) is { } problem) { Console.WriteLine(problem); return; }
    Console.Write("Repeat it: ");
    if (ReadHidden() != password) { Console.WriteLine("The two passwords don't match."); return; }
    var created = await scope.ServiceProvider.GetRequiredService<AdminAccounts>().UpsertAsync(email, password);
    Console.WriteLine(created
        ? $"Created the studio account {email}. Sign in at /admin."
        : $"Updated the password for {email} and unlocked it. Other sessions are signed out.");
    return;
}

// "migrate" command, or Database:MigrateOnStartup=true on the server: bring the schema up to date,
// then add the starting content if the database is empty. Safe to run on every start.
if (command == "migrate" || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    log.LogInformation("Database is up to date. {Seed}",
        await scope.ServiceProvider.GetRequiredService<ContentSeeder>().SeedAsync(seedPath));
    if (command == "migrate") return;
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
