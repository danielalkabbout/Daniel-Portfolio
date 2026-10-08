using System.Numerics;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Services;

public enum SignInStatus { Ok, Wrong, LockedOut, NoAccount, Expired }

public sealed record SignInResult(SignInStatus Status, AdminAccount? Account = null, TimeSpan? RetryAfter = null, string? ServerProof = null);

public sealed record SrpChallenge(string ChallengeId, string Salt, string B, int Iterations);

/// <summary>
/// Studio sign-in with SRP-6a (see Srp.cs). Step 1, <see cref="ChallengeAsync"/>: the browser sends a fingerprint
/// of the email and gets the salt and the server's public value B. Step 2, <see cref="SignInAsync"/>: it sends its
/// public value A and the proof M1. The password and the email never travel.
/// </summary>
public class AdminAccounts(AppDbContext db, IMemoryCache cache, IOptions<JwtOptions> jwt, TimeProvider clock)
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutTime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(2);
    public const int MinPasswordLength = 12;

    private sealed record Pending(int? AccountId, string Identity, byte[] Salt, BigInteger V, BigInteger b, BigInteger B);

    private static readonly SrpGroup Group = SrpGroup.Studio;

    public static string Normalize(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public static string? CheckNewPassword(string? password) =>
        string.IsNullOrEmpty(password) || password.Length < MinPasswordLength
            ? $"Use at least {MinPasswordLength} characters."
            : password.Length > 200 ? "Use at most 200 characters." : null;

    public Task<bool> AnyAsync(CancellationToken ct = default) => db.AdminAccounts.AnyAsync(ct);

    public Task<AdminAccount?> FindAsync(int id, CancellationToken ct = default) =>
        db.AdminAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);

    /// <summary>
    /// Step 1. Unknown emails get a believable salt and B too, so the answer doesn't reveal whether an account exists.
    /// Returns null only when no studio account has been created at all.
    /// </summary>
    public async Task<SrpChallenge?> ChallengeAsync(string? loginId, CancellationToken ct = default)
    {
        var accounts = await db.AdminAccounts.AsNoTracking()
            .Where(a => a.SrpVerifier != "")
            .Select(a => new { a.Id, a.Email, a.SrpSalt, a.SrpVerifier })
            .ToListAsync(ct);
        if (accounts.Count == 0) return null;

        var id = (loginId ?? "").Trim().ToLowerInvariant();
        var account = accounts.FirstOrDefault(a => FixedEquals(Srp.LoginId(a.Email), id));
        Pending pending;
        if (account is not null)
        {
            var salt = Convert.FromHexString(account.SrpSalt);
            var v = Srp.FromHex(account.SrpVerifier);
            var (b, B) = Srp.ServerEphemeral(Group, v);
            pending = new Pending(account.Id, account.Email, salt, v, b, B);
        }
        else
        {
            // Same salt for the same unknown fingerprint every time, and a random verifier nobody can match.
            var salt = HMACSHA256.HashData(System.Text.Encoding.UTF8.GetBytes(jwt.Value.Key),
                System.Text.Encoding.UTF8.GetBytes("salt:" + id))[..Srp.SaltBytes];
            var v = BigInteger.ModPow(Group.G, new BigInteger(RandomNumberGenerator.GetBytes(32), true, true), Group.N);
            var (b, B) = Srp.ServerEphemeral(Group, v);
            pending = new Pending(null, "", salt, v, b, B);
        }

        var challengeId = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));
        cache.Set(Key(challengeId), pending, ChallengeLifetime);
        return new SrpChallenge(challengeId, Convert.ToHexStringLower(pending.Salt), Srp.Hex(pending.B, Group), Srp.Iterations);
    }

    /// <summary>Step 2. Each challenge works once. Five wrong proofs lock the account for 15 minutes.</summary>
    public async Task<SignInResult> SignInAsync(string? challengeId, string? a, string? m1, CancellationToken ct = default)
    {
        if (!await AnyAsync(ct)) return new SignInResult(SignInStatus.NoAccount);
        if (Take(challengeId) is not { } pending) return new SignInResult(SignInStatus.Expired);
        if (pending.AccountId is not { } id || await db.AdminAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) is not { } account)
        {
            Check(pending, a, m1); // same work as a real check, so timing doesn't reveal unknown emails
            return new SignInResult(SignInStatus.Wrong);
        }

        var now = clock.GetUtcNow().UtcDateTime;
        if (account.LockedUntil is { } until && until > now)
            return new SignInResult(SignInStatus.LockedOut, RetryAfter: until - now);

        if (Check(pending, a, m1) is not { } m2)
        {
            account.FailedLoginCount++;
            if (account.FailedLoginCount >= MaxFailedAttempts)
            {
                account.LockedUntil = now.Add(LockoutTime);
                account.FailedLoginCount = 0;
            }
            await db.SaveChangesAsync(ct);
            return account.LockedUntil > now
                ? new SignInResult(SignInStatus.LockedOut, RetryAfter: LockoutTime)
                : new SignInResult(SignInStatus.Wrong);
        }

        account.FailedLoginCount = 0;
        account.LockedUntil = null;
        account.LastLoginAt = now;
        await db.SaveChangesAsync(ct);
        return new SignInResult(SignInStatus.Ok, account, ServerProof: m2);
    }

    /// <summary>
    /// Changes the password: the browser proves the current one (a fresh challenge) and sends the new salt and
    /// verifier it computed. The new password never reaches the server. Other sessions are signed out.
    /// </summary>
    public async Task<string?> ChangePasswordAsync(AdminAccount account, string? challengeId, string? a, string? m1,
        string? newSalt, string? newVerifier, CancellationToken ct = default)
    {
        if (Take(challengeId) is not { } pending || pending.AccountId != account.Id || Check(pending, a, m1) is null)
            return "Your current password is not correct.";
        if (!IsHex(newSalt, Srp.SaltBytes * 2, Srp.SaltBytes * 2) || !IsHex(newVerifier, 2, Group.Length * 2))
            return "The new password could not be prepared. Reload the page and try again.";
        var v = Srp.FromHex(newVerifier!);
        if (v <= BigInteger.One || v >= Group.N) return "The new password could not be prepared. Reload the page and try again.";
        if (string.Equals(newVerifier, account.SrpVerifier, StringComparison.OrdinalIgnoreCase))
            return "Choose a password different from the current one.";

        account.SrpSalt = newSalt!.ToLowerInvariant();
        account.SrpVerifier = Srp.Hex(v, Group);
        NewStamp(account);
        await db.SaveChangesAsync(ct);
        return null;
    }

    /// <summary>Creates the account, or resets its password and unlocks it. Used by the create-admin command.</summary>
    public async Task<bool> UpsertAsync(string email, string password, CancellationToken ct = default)
    {
        var normalized = Normalize(email);
        var account = await db.AdminAccounts.FirstOrDefaultAsync(a => a.Email == normalized, ct);
        var created = account is null;
        if (created)
        {
            account = new AdminAccount { Email = normalized };
            db.AdminAccounts.Add(account);
        }
        (account!.SrpSalt, account.SrpVerifier) = Srp.Register(normalized, password);
        NewStamp(account);
        await db.SaveChangesAsync(ct);
        return created;
    }

    private static string Key(string id) => "srp-challenge:" + id;

    private Pending? Take(string? challengeId)
    {
        if (string.IsNullOrEmpty(challengeId) || !cache.TryGetValue(Key(challengeId), out Pending? p)) return null;
        cache.Remove(Key(challengeId));
        return p;
    }

    private static string? Check(Pending p, string? a, string? m1)
    {
        if (!IsHex(a, 2, Group.Length * 2) || !IsHex(m1, 64, 64)) return null;
        var proof = Srp.Verify(Group, p.Identity, p.Salt, p.V, p.b, p.B, Srp.FromHex(a!), Convert.FromHexString(m1!));
        return proof is null || p.AccountId is null ? null : Convert.ToHexStringLower(proof);
    }

    private static bool IsHex(string? s, int min, int max) =>
        s is not null && s.Length >= min && s.Length <= max && s.All(Uri.IsHexDigit);

    private static bool FixedEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(a), System.Text.Encoding.UTF8.GetBytes(b));

    private static void NewStamp(AdminAccount account)
    {
        account.SecurityStamp = Guid.NewGuid().ToString("N");
        account.FailedLoginCount = 0;
        account.LockedUntil = null;
    }
}
