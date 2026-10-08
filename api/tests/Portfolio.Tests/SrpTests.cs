using System.Numerics;
using System.Security.Cryptography;
using Portfolio.Api.Services;

namespace Portfolio.Tests;

/// <summary>
/// SRP maths against the RFC 5054 test vectors, and against fixed values that the browser code
/// (web/src/features/admin/srp.test.ts) and an independent Python script must also produce.
/// </summary>
public class SrpTests
{
    private static BigInteger H(string hex) => Srp.FromHex(hex.Replace(" ", ""));

    [Fact]
    public void Matches_the_RFC_5054_test_vectors()
    {
        var g = new SrpGroup(
            "EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E2" +
            "50B98BE48E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B297BCF1885C529F566660E57EC68EDBC3C05726CC0" +
            "2FD4CBF4976EAA9AFD5138FE8376435B9FC61D2FC0EB06E3", 2, SHA1.HashData);
        var salt = Convert.FromHexString("BEB25379D1A8581EB5A727673A2441EE");
        var a = H("60975527 035CF2AD 1989806F 0407210B C81EDC04 E2762A56 AFD529DD DA2D4393");
        var b = H("E487CB59 D31AC550 471E81F0 0F6928E0 1DDA08E9 74A004F4 9E61F5D1 05284D20");

        Assert.Equal(H("7556AA04 5AEF2CDD 07ABAF0F 665C3E81 8913186F"), Srp.K(g));
        var x = Srp.X(g, salt, "alice", "password123");
        Assert.Equal(H("94B7555A ABE9127C C58CCF49 93DB6CF8 4D16C124"), x);
        var v = Srp.Verifier(g, salt, "alice", "password123");
        Assert.StartsWith("7e273de8696ffc4f4e337d05b4b375beb0dde156", Convert.ToHexStringLower(g.Pad(v)));

        var A = BigInteger.ModPow(g.G, a, g.N);
        var (_, B) = Srp.ServerEphemeral(g, v, b);
        var u = new BigInteger(g.H(g.Pad(A), g.Pad(B)), isUnsigned: true, isBigEndian: true);
        Assert.Equal(H("CE38B959 3487DA98 554ED47D 70A7AE5F 462EF019"), u);
        var S = BigInteger.ModPow(A * BigInteger.ModPow(v, u, g.N), b, g.N);
        Assert.StartsWith("b0dc82babcf30674ae450c0287745e7990a3381f", Convert.ToHexStringLower(g.Pad(S)));
    }

    // Shared with srp.test.ts and the Python check.
    private const string Email = "daniel@example.com";
    private const string Password = "correct horse battery staple";
    private const string Salt = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
    private const string FixedA = "1f2e3d4c5b6a79880f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778";
    private const string FixedB = "8899aabbccddeeff00112233445566778796a5b4c3d2e1f00f1e2d3c4b5a6978";
    private const string Hardened = "2beb29a0fb4649a96df5ef8e6523300101a899adf282701953312383de1a9e6f";
    private const string V = "682e0e234715ab400c344ed34bbbda30aef958701424263d88fe234db7c551594e63d480dd13290b1e67a2b1080b7f85e1b4d6c0e8cc9b61552e96d40fc32b9628008b8476ceb22c9ba1cd0007eca1cf98bdf237118a223c93e0e589a01392a326938495e7db891740e97bf59f039126950bf88be11a685195542354f987e79933cc0e74103cdbed533b63961fdb30c09cb9667d9a06d5b1c10ffa53d0a474c1c4c1195f2bc923fed8cf0b57b1e70fd3f82dcb315a129765b0d2ea1095d01d7a5234f2e31c4eb509165c4b0b6c0793a448e89b099fc9491ab1d5263878390ef82f064dc92e27583a930f8911803f125a1590bf5d9ffb848999c0250de31e7618";
    private const string ExpectedA = "211d2b156c1a6a520e4005709f3adb59d151ed2b2505e2977224723ff7d49973ad90f8ea5458966fe6b2e55a92f5e2f81585dae5bb2f018187393aa34b20b7f89d4876bda01eb32d11a1734d7f7cc794cc4f2dadc0dc85b0e50cde378cc7c16557e398589914c151d5eebdb8a68fde50ecb0dd2e4fc3640b11d74cd6458a11140c4d24541e446b2337ec110894dc21f7021a1273a0e77eff0f18a4c59c2ccc631c2d22eb627b4edfcfbcf2e2b57e473051cc16e87b964255b5c0ebe164c7bd6ee35a0b4fbd5dd17ecfe5eb14126ec10fe85397536696dba3830a95440e6a3db0a9a71c0c2a2020f0f17b69b5174c39b78cbabcac61c19a2af42b2cde4a3b7933";
    private const string ExpectedB = "17624790b200768133c469baf7fa753630f0e516f9d4bb0faba3a5561b99c6d18961ed61ab72ff365bda98d85bdc4721a1cbf300fc7058ea83562100ca25fb01d82f8a14a09c28c91378af89d3c46c5d35f7cd280f0201c2a03f5f017ba513d144834096fe6ac6132021324f1373e2e454b5bd5d6845d7d4c36c85b7e886df6b5eea5b766c58ece3eebcc741f225e76143ee136c062291e67a65693d331a5de185cae4117952cde403e82b67e569c9a676aab26af642acf07447d790ddf4f3a4e7ea53c67f1a256c041bb89cbcbaa360663f6c1f11291222ff5ebf450671c70e824510d986ef6ff9cf62b05285e5fb16c2de99ffd0a171fc22d79396f7a14bae";
    private const string M1 = "cfd7f5938e91f7f3f26f68f6e532459439f00a7dd5d012c9542123c3034bda2b";
    private const string M2 = "d4607ddd63ed61b137dff9274f9c111da3d3298103b8901c3405eda1a9a9b92f";
    private const string LoginId = "638175c12e1a26b7e4ac19f49e74fbabbdd9cb9ad871d84e52a6d30c0bdc24b2";

    [Fact]
    public void Server_and_browser_agree_on_the_fixed_values()
    {
        var g = SrpGroup.Studio;
        var salt = Convert.FromHexString(Salt);
        Assert.Equal(Hardened, Srp.Harden(Password, salt));
        var v = Srp.Verifier(g, salt, Email, Hardened);
        Assert.Equal(V, Srp.Hex(v, g));
        var (b, B) = Srp.ServerEphemeral(g, v, Srp.FromHex(FixedB));
        Assert.Equal(ExpectedB, Srp.Hex(B, g));

        var (a, m1, _) = SrpClient.Prove(Email, Password, Salt, ExpectedB, Srp.Iterations, Srp.FromHex(FixedA));
        Assert.Equal(ExpectedA, a);
        Assert.Equal(M1, m1);
        var m2 = Srp.Verify(g, Email, salt, v, b, B, Srp.FromHex(ExpectedA), Convert.FromHexString(M1));
        Assert.Equal(M2, Convert.ToHexStringLower(m2!));
        Assert.Equal(LoginId, Srp.LoginId(Email));
    }

    [Fact]
    public void A_wrong_password_or_a_zero_A_is_refused()
    {
        var g = SrpGroup.Studio;
        var salt = Convert.FromHexString(Salt);
        var v = Srp.Verifier(g, salt, Email, Hardened);
        var (b, B) = Srp.ServerEphemeral(g, v);
        var (a, m1, _) = SrpClient.Prove(Email, "not the password", Salt, Srp.Hex(B, g), Srp.Iterations);
        Assert.Null(Srp.Verify(g, Email, salt, v, b, B, Srp.FromHex(a), Convert.FromHexString(m1)));
        Assert.Null(Srp.Verify(g, Email, salt, v, b, B, BigInteger.Zero, new byte[32]));
        Assert.Null(Srp.Verify(g, Email, salt, v, b, B, g.N, new byte[32]));
    }
}
