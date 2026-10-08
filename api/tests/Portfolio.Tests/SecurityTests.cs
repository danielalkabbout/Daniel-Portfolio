using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;

namespace Portfolio.Tests;

/// <summary>The studio session cookie, CSRF protection and the website-only gate.</summary>
[Collection(DbCollection.Name)]
public class SecurityTests(ApiFactory factory)
{
    [SkippableFact]
    public async Task Login_sets_an_HttpOnly_cookie_and_never_returns_the_token()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var login = await SrpClient.LoginAsync(factory.CreateClient(), ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith(SessionCookie.Name + "="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api", cookie, StringComparison.OrdinalIgnoreCase);

        var body = await login.Content.ReadAsStringAsync();
        Assert.DoesNotContain(ApiFactory.SessionToken(login), body);
        Assert.DoesNotContain("token", body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("no-store", login.Headers.CacheControl?.ToString());
    }

    [SkippableFact]
    public async Task Neither_the_email_nor_the_password_is_ever_sent()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var sent = new List<string>();
        var client = factory.CreateDefaultClient(new Recorder(sent));
        client.DefaultRequestHeaders.Add(ApiSecurity.CsrfHeader, "tests");
        var login = await SrpClient.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(2, sent.Count);
        foreach (var body in sent)
        {
            Assert.DoesNotContain(ApiFactory.AdminPassword, body);
            Assert.DoesNotContain(ApiFactory.AdminEmail, body);
            Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>Keeps a copy of every request body, like the browser's Network tab.</summary>
    private sealed class Recorder(List<string> sent) : DelegatingHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null) sent.Add(await request.Content.ReadAsStringAsync(ct));
            return await base.SendAsync(request, ct);
        }
    }

    [SkippableFact]
    public async Task The_cookie_signs_in_and_logout_ends_it()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var client = factory.CreateClient(); // keeps cookies between requests, like a browser
        (await SrpClient.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword)).EnsureSuccessStatusCode();

        var me = await client.GetFromJsonAsync<SessionResponse>("/api/auth/me");
        Assert.Equal(ApiFactory.AdminEmail, me!.Email);
        Assert.True(me.ExpiresAt > DateTime.UtcNow);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/content")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [SkippableFact]
    public async Task Changes_without_the_CSRF_header_are_refused()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Remove(ApiSecurity.CsrfHeader);
        var challenge = await client.PostAsJsonAsync("/api/auth/challenge", new ChallengeRequest(Srp.LoginId(ApiFactory.AdminEmail)));
        Assert.Equal(HttpStatusCode.Forbidden, challenge.StatusCode);
    }

    [SkippableFact]
    public async Task With_an_edge_key_only_the_proxy_can_sign_in()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        using var guarded = factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration(c =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["Edge:Key"] = "edge-secret-for-tests" })));

        var direct = guarded.CreateClient(new WebApplicationFactoryClientOptions());
        direct.DefaultRequestHeaders.Add(ApiSecurity.CsrfHeader, "tests");
        Assert.Equal(HttpStatusCode.OK, (await direct.GetAsync("/api/content")).StatusCode);
        var refused = await direct.PostAsJsonAsync("/api/auth/challenge", new ChallengeRequest(Srp.LoginId(ApiFactory.AdminEmail)));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);

        var wrongKey = guarded.CreateClient();
        wrongKey.DefaultRequestHeaders.Add(ApiSecurity.CsrfHeader, "tests");
        wrongKey.DefaultRequestHeaders.Add(ApiSecurity.EdgeKeyHeader, "not-the-key");
        Assert.Equal(HttpStatusCode.Forbidden,
            (await wrongKey.PostAsJsonAsync("/api/auth/challenge", new ChallengeRequest(Srp.LoginId(ApiFactory.AdminEmail)))).StatusCode);

        var proxy = guarded.CreateClient();
        proxy.DefaultRequestHeaders.Add(ApiSecurity.CsrfHeader, "tests");
        proxy.DefaultRequestHeaders.Add(ApiSecurity.EdgeKeyHeader, "edge-secret-for-tests");
        proxy.DefaultRequestHeaders.Add(ApiSecurity.ClientIpHeader, "203.0.113.7");
        Assert.Equal(HttpStatusCode.OK, (await SrpClient.LoginAsync(proxy, ApiFactory.AdminEmail, ApiFactory.AdminPassword)).StatusCode);
    }
}
