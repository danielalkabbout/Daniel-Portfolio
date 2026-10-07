using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Portfolio.Api.Controllers;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Tests;

/// <summary>
/// Runs the API against a real, throwaway PostgreSQL database.
/// Set the TEST_DB environment variable to a server connection string to enable these tests
/// (CI does this with a Postgres container). Without it they are skipped.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "correct horse battery staple";

    private static readonly string? ServerConnection = Environment.GetEnvironmentVariable("TEST_DB");
    private readonly string connectionString = "";

    public bool Enabled => !string.IsNullOrWhiteSpace(ServerConnection);

    public ApiFactory()
    {
        if (!Enabled) return;
        connectionString = new NpgsqlConnectionStringBuilder(ServerConnection)
        {
            Database = "portfolio_test_" + Guid.NewGuid().ToString("N")[..8],
        }.ConnectionString;

        // Program.cs reads these while starting up, so they are set as environment variables.
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", connectionString);
        Environment.SetEnvironmentVariable("Admin__Email", AdminEmail);
        Environment.SetEnvironmentVariable("Admin__PasswordHash", AuthController.HashPassword(AdminPassword));
        Environment.SetEnvironmentVariable("Jwt__Key", new string('k', 48));
    }

    private string? adminToken;

    /// <summary>Logs in once and reuses the token, so the tests stay under the login rate limit.</summary>
    public async Task<string> AdminTokenAsync()
    {
        if (adminToken is not null) return adminToken;
        var login = await CreateClient().PostAsJsonAsync("/api/auth/login",
            new Portfolio.Api.Contracts.LoginRequest(AdminEmail, AdminPassword));
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<Portfolio.Api.Contracts.LoginResponse>(System.Text.Json.JsonSerializerOptions.Web);
        return adminToken = body!.Token;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development");

    public async Task InitializeAsync()
    {
        if (!Enabled) return;
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        var seeder = scope.ServiceProvider.GetRequiredService<ContentSeeder>();
        await seeder.SeedAsync(TestPaths.SeedFile());
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        if (Enabled)
        {
            using var scope = Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        }
        await base.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class DbCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "database";
}
