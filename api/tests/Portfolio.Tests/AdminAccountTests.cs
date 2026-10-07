using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Tests;

/// <summary>The studio account lives in the database. Each test uses its own account so they don't interfere.</summary>
[Collection(DbCollection.Name)]
public class AdminAccountTests(ApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    private async Task CreateAccountAsync(string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AdminAccounts>().UpsertAsync(email, password);
    }

    private async Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));

    private HttpClient Client(string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [SkippableFact]
    public async Task First_sign_in_stores_the_configured_admin_in_the_database()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        await factory.AdminTokenAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await db.AdminAccounts.SingleAsync(a => a.Email == ApiFactory.AdminEmail);
        Assert.StartsWith("AQAAAA", account.PasswordHash);
        Assert.NotNull(account.LastLoginAt);
    }

    [SkippableFact]
    public async Task Email_is_not_case_sensitive()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        await CreateAccountAsync("case@test.local", "a long enough password");
        var response = await LoginAsync("  CASE@Test.Local ", "a long enough password");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task Changing_the_password_ends_old_sessions()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "change@test.local";
        await CreateAccountAsync(email, "the first password");
        var login = await (await LoginAsync(email, "the first password")).Content.ReadFromJsonAsync<LoginResponse>(Json);
        var oldClient = Client(login!.Token);
        Assert.Equal(HttpStatusCode.OK, (await oldClient.GetAsync("/api/auth/me")).StatusCode);

        var tooShort = await oldClient.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest("the first password", "short"));
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
        var wrongCurrent = await oldClient.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest("not it at all", "the second password"));
        Assert.Equal(HttpStatusCode.BadRequest, wrongCurrent.StatusCode);

        var changed = await oldClient.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest("the first password", "the second password"));
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var fresh = await changed.Content.ReadFromJsonAsync<LoginResponse>(Json);

        Assert.Equal(HttpStatusCode.Unauthorized, (await oldClient.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Client(fresh!.Token).GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "the first password")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, "the second password")).StatusCode);
    }

    [SkippableFact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "lock@test.local";
        await CreateAccountAsync(email, "the right password");
        using var scope = factory.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<AdminAccounts>();

        for (var i = 1; i < AdminAccounts.MaxFailedAttempts; i++)
            Assert.Equal(SignInStatus.Wrong, (await accounts.SignInAsync(email, "wrong")).Status);
        Assert.Equal(SignInStatus.LockedOut, (await accounts.SignInAsync(email, "wrong")).Status);
        Assert.Equal(SignInStatus.LockedOut, (await accounts.SignInAsync(email, "the right password")).Status);

        // create-admin resets the password and unlocks the account
        await accounts.UpsertAsync(email, "the right password");
        Assert.Equal(SignInStatus.Ok, (await accounts.SignInAsync(email, "the right password")).Status);
    }
}
