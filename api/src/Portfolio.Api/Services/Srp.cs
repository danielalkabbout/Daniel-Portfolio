using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace Portfolio.Api.Services;

/// <summary>
/// SRP-6a (RFC 5054): the studio proves it knows the password without ever sending it.
/// The browser sends A and a one-time proof M1; the server keeps only a verifier v, from which the
/// password can't be used to sign in directly. The browser half lives in web/src/features/admin/srp.ts
/// and both are checked against the same fixed values in the tests.
///
/// Password -> PBKDF2-SHA256(password, salt, Iterations) -> hex = P'
/// x = H(salt | H(I ":" P'))     v = g^x mod N     k = H(PAD(N) | PAD(g))
/// u = H(PAD(A) | PAD(B))        K = H(PAD(S))
/// M1 = H(H(N) xor H(g) | H(I) | salt | PAD(A) | PAD(B) | K)      M2 = H(PAD(A) | M1 | K)
/// </summary>
public sealed class SrpGroup
{
    public BigInteger N { get; }
    public BigInteger G { get; }
    public int Length { get; }
    private readonly Func<byte[], byte[]> hash;

    public SrpGroup(string nHex, int g, Func<byte[], byte[]> hash)
    {
        N = Srp.FromHex(nHex);
        G = g;
        Length = (int)((N.GetBitLength() + 7) / 8);
        this.hash = hash;
    }

    public byte[] H(params byte[][] parts) => hash([.. parts.SelectMany(p => p)]);
    public byte[] Pad(BigInteger i) => Srp.ToBytes(i, Length);

    /// <summary>RFC 5054 2048-bit group with SHA-256: what the studio uses.</summary>
    public static readonly SrpGroup Studio = new(
        "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310D" +
        "CD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF74" +
        "7359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D" +
        "5EA77A2775D2ECFA032CFBDBF52FB37861602790" + "04E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB6" +
        "94B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F9E4AFF73",
        2, SHA256.HashData);
}

public static class Srp
{
    /// <summary>PBKDF2 rounds applied to the password before SRP, so a stolen verifier is slow to guess against.</summary>
    public const int Iterations = 210_000;
    public const int SaltBytes = 16;

    public static BigInteger FromHex(string hex) =>
        new(Convert.FromHexString(hex.Length % 2 == 1 ? "0" + hex : hex), isUnsigned: true, isBigEndian: true);

    public static byte[] ToBytes(BigInteger i, int length = 0)
    {
        var raw = i.ToByteArray(isUnsigned: true, isBigEndian: true);
        if (raw.Length >= length) return raw;
        var padded = new byte[length];
        raw.CopyTo(padded, length - raw.Length);
        return padded;
    }

    public static string Hex(BigInteger i, SrpGroup g) => Convert.ToHexStringLower(g.Pad(i));

    private static BigInteger Int(byte[] bytes) => new(bytes, isUnsigned: true, isBigEndian: true);
    private static BigInteger Mod(BigInteger a, BigInteger n) => ((a % n) + n) % n;

    /// <summary>The password after PBKDF2, as the browser computes it.</summary>
    public static string Harden(string password, byte[] salt, int iterations = Iterations) =>
        Convert.ToHexStringLower(Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, iterations,
            HashAlgorithmName.SHA256, 32));

    public static BigInteger X(SrpGroup g, byte[] salt, string identity, string password) =>
        Int(g.H(salt, g.H(Encoding.UTF8.GetBytes(identity + ":" + password))));

    public static BigInteger K(SrpGroup g) => Int(g.H(g.Pad(g.N), g.Pad(g.G)));

    public static BigInteger Verifier(SrpGroup g, byte[] salt, string identity, string hardenedPassword) =>
        BigInteger.ModPow(g.G, X(g, salt, identity, hardenedPassword), g.N);

    /// <summary>A new salt and verifier for a password (create-admin command). The password is used only here.</summary>
    public static (string Salt, string Verifier) Register(string identity, string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var v = Verifier(SrpGroup.Studio, salt, identity, Harden(password, salt));
        return (Convert.ToHexStringLower(salt), Hex(v, SrpGroup.Studio));
    }

    /// <summary>Server's ephemeral pair. b stays on the server; B goes to the browser.</summary>
    public static (BigInteger b, BigInteger B) ServerEphemeral(SrpGroup g, BigInteger v, BigInteger? fixedB = null)
    {
        BigInteger b;
        do b = fixedB ?? Int(RandomNumberGenerator.GetBytes(32));
        while (b.IsZero);
        var B = Mod(K(g) * v + BigInteger.ModPow(g.G, b, g.N), g.N);
        return (b, B);
    }

    /// <summary>Checks the browser's proof. Returns M2 (the server's proof) when it is right, otherwise null.</summary>
    public static byte[]? Verify(SrpGroup g, string identity, byte[] salt, BigInteger v,
        BigInteger b, BigInteger B, BigInteger A, byte[] m1)
    {
        if (Mod(A, g.N).IsZero) return null; // a malicious A of 0 (or N) would make the key predictable
        var u = Int(g.H(g.Pad(A), g.Pad(B)));
        if (u.IsZero) return null;
        var S = BigInteger.ModPow(A * BigInteger.ModPow(v, u, g.N), b, g.N);
        var key = g.H(g.Pad(S));
        var expected = M1(g, identity, salt, A, B, key);
        if (m1.Length != expected.Length || !CryptographicOperations.FixedTimeEquals(m1, expected)) return null;
        return g.H(g.Pad(A), expected, key);
    }

    public static byte[] M1(SrpGroup g, string identity, byte[] salt, BigInteger A, BigInteger B, byte[] key)
    {
        var hn = g.H(ToBytes(g.N));
        var hg = g.H(ToBytes(g.G));
        var x = new byte[hn.Length];
        for (var i = 0; i < x.Length; i++) x[i] = (byte)(hn[i] ^ hg[i]);
        return g.H(x, g.H(Encoding.UTF8.GetBytes(identity)), salt, g.Pad(A), g.Pad(B), key);
    }

    /// <summary>What the browser sends instead of the email: a fingerprint of it.</summary>
    public static string LoginId(string normalizedEmail) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("dk-studio:" + normalizedEmail)));
}
