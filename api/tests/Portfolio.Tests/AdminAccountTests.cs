using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
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
    private async Task CreateAccountAsync(string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AdminAccounts>().UpsertAsync(email, password);
    }

    private HttpClient Client(string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [SkippableFact]
    public async Task The_database_keeps_only_an_SRP_verifier()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "store@test.local";
        await CreateAccountAsync(email, "a long enough password");
        using var scope = factory.Services.CreateScope();
        var account = await scope.ServiceProvider.GetRequiredService<AppDbContext>().AdminAccounts.SingleAsync(a => a.Email == email);
        Assert.Equal(32, account.SrpSalt.Length);
        Assert.Equal(512, account.SrpVerifier.Length);
        Assert.DoesNotContain("long enough", account.SrpVerifier + account.SrpSalt);
    }

    [SkippableFact]
    public async Task Email_is_not_case_sensitive()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        await CreateAccountAsync("case@test.local", "a long enough password");
        var response = await SrpClient.LoginAsync(factory.CreateClient(), "  CASE@Test.Local ", "a long enough password");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task Unknown_emails_get_a_normal_looking_challenge()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var client = factory.CreateClient();
        var first = await SrpClient.ChallengeAsync(client, "nobody@test.local");
        var again = await SrpClient.ChallengeAsync(client, "nobody@test.local");
        Assert.Equal(32, first.Salt.Length);
        Assert.Equal(512, first.B.Length);
        Assert.Equal(first.Salt, again.Salt); // stable, like a real account's salt
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await SrpClient.LoginAsync(client, "nobody@test.local", "whatever it is")).StatusCode);
    }

    [SkippableFact]
    public async Task A_challenge_works_only_once()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "once@test.local";
        await CreateAccountAsync(email, "a long enough password");
        var client = factory.CreateClient();
        var c = await SrpClient.ChallengeAsync(client, email);
        var (a, m1, _) = SrpClient.Prove(email, "a long enough password", c.Salt, c.B, c.Iterations);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(c.ChallengeId, a, m1))).StatusCode);
        // Replaying the captured request fails.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(c.ChallengeId, a, m1))).StatusCode);
    }

    [SkippableFact]
    public async Task Changing_the_password_ends_old_sessions()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "change@test.local";
        await CreateAccountAsync(email, "the first password");
        var login = await SrpClient.LoginAsync(factory.CreateClient(), email, "the first password");
        var oldClient = Client(ApiFactory.SessionToken(login));
        Assert.Equal(HttpStatusCode.OK, (await oldClient.GetAsync("/api/auth/me")).StatusCode);

        async Task<HttpResponseMessage> Change(string current, string next)
        {
            var c = await SrpClient.ChallengeAsync(oldClient, email);
            var (a, m1, _) = SrpClient.Prove(email, current, c.Salt, c.B, c.Iterations);
            var (salt, verifier) = Srp.Register(email, next); // done in the browser in real life
            return await oldClient.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(c.ChallengeId, a, m1, salt, verifier));
        }

        var wrongCurrent = await Change("not it at all", "the second password");
        Assert.Equal(HttpStatusCode.BadRequest, wrongCurrent.StatusCode);
        var badVerifier = await oldClient.PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("nope", "ab", new string('0', 64), "zz", "0"));
        Assert.Equal(HttpStatusCode.BadRequest, badVerifier.StatusCode);

        var changed = await Change("the first password", "the second password");
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var fresh = ApiFactory.SessionToken(changed);

        Assert.Equal(HttpStatusCode.Unauthorized, (await oldClient.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Client(fresh).GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SrpClient.LoginAsync(factory.CreateClient(), email, "the first password")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SrpClient.LoginAsync(factory.CreateClient(), email, "the second password")).StatusCode);
    }

    [SkippableFact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        const string email = "lock@test.local";
        await CreateAccountAsync(email, "the right password");
        using var scope = factory.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<AdminAccounts>();

        async Task<SignInStatus> Try(string password)
        {
            var c = (await accounts.ChallengeAsync(Srp.LoginId(email)))!;
            var (a, m1, _) = SrpClient.Prove(email, password, c.Salt, c.B, c.Iterations);
            return (await accounts.SignInAsync(c.ChallengeId, a, m1)).Status;
        }

        for (var i = 1; i < AdminAccounts.MaxFailedAttempts; i++)
            Assert.Equal(SignInStatus.Wrong, await Try("wrong"));
        Assert.Equal(SignInStatus.LockedOut, await Try("wrong"));
        Assert.Equal(SignInStatus.LockedOut, await Try("the right password"));

        // create-admin resets the password and unlocks the account
        await accounts.UpsertAsync(email, "the right password");
        Assert.Equal(SignInStatus.Ok, await Try("the right password"));
        Assert.Equal(SignInStatus.Expired, (await accounts.SignInAsync("unknown", "ab", Convert.ToHexString(RandomNumberGenerator.GetBytes(32)))).Status);
    }
}
