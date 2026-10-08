using System.Net.Http.Json;
using System.Numerics;
using System.Security.Cryptography;
using System.Text.Json;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;

namespace Portfolio.Tests;

/// <summary>The browser half of the SRP sign-in, in C#, so the tests can sign in the way the studio does.</summary>
public static class SrpClient
{
    public sealed record Challenge(string ChallengeId, string Salt, string B, int Iterations);

    private static readonly SrpGroup G = SrpGroup.Studio;

    public static async Task<Challenge> ChallengeAsync(HttpClient client, string email)
    {
        var res = await client.PostAsJsonAsync("/api/auth/challenge",
            new ChallengeRequest(Srp.LoginId(AdminAccounts.Normalize(email))));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<Challenge>(JsonSerializerOptions.Web))!;
    }

    /// <summary>A and M1 for a challenge. Only these leave the "browser".</summary>
    public static (string A, string M1, byte[] Key) Prove(string email, string password, string saltHex, string bHex,
        int iterations, BigInteger? fixedA = null)
    {
        var identity = AdminAccounts.Normalize(email);
        var salt = Convert.FromHexString(saltHex);
        var B = Srp.FromHex(bHex);
        var a = fixedA ?? new BigInteger(RandomNumberGenerator.GetBytes(32), isUnsigned: true, isBigEndian: true);
        var A = BigInteger.ModPow(G.G, a, G.N);
        var u = new BigInteger(G.H(G.Pad(A), G.Pad(B)), isUnsigned: true, isBigEndian: true);
        var x = Srp.X(G, salt, identity, Srp.Harden(password, salt, iterations));
        var k = Srp.K(G);
        var baseValue = ((B - k * BigInteger.ModPow(G.G, x, G.N)) % G.N + G.N) % G.N;
        var S = BigInteger.ModPow(baseValue, a + u * x, G.N);
        var key = G.H(G.Pad(S));
        var m1 = Srp.M1(G, identity, salt, A, B, key);
        return (Srp.Hex(A, G), Convert.ToHexStringLower(m1), key);
    }

    public static async Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password)
    {
        var c = await ChallengeAsync(client, email);
        var (a, m1, _) = Prove(email, password, c.Salt, c.B, c.Iterations);
        return await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(c.ChallengeId, a, m1));
    }
}
