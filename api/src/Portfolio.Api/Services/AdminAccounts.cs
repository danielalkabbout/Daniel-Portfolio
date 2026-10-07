using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Services;

public enum SignInStatus { Ok, Wrong, LockedOut, NoAccount }

public sealed record SignInResult(SignInStatus Status, AdminAccount? Account = null, TimeSpan? RetryAfter = null);

/// <summary>Studio sign-in backed by the AdminAccounts table.</summary>
public class AdminAccounts(AppDbContext db, IOptions<AdminOptions> bootstrap, TimeProvider clock)
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutTime = TimeSpan.FromMinutes(15);
    public const int MinPasswordLength = 12;

    private static readonly PasswordHasher<AdminAccount> Hasher = new();
    // Checked when the email is unknown, so a wrong email takes as long as a wrong password.
    private static readonly string DummyHash = Hasher.HashPassword(new AdminAccount(), Guid.NewGuid().ToString());

    public static string Normalize(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public static string Hash(string password) => Hasher.HashPassword(new AdminAccount(), password);

    public static string? CheckNewPassword(string? password) =>
        string.IsNullOrEmpty(password) || password.Length < MinPasswordLength
            ? $"Use at least {MinPasswordLength} characters."
            : password.Length > 200 ? "Use at most 200 characters." : null;

    public Task<bool> AnyAsync(CancellationToken ct = default) => db.AdminAccounts.AnyAsync(ct);

    public Task<AdminAccount?> FindAsync(int id, CancellationToken ct = default) =>
        db.AdminAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);

    public async Task<SignInResult> SignInAsync(string? email, string? password, CancellationToken ct = default)
    {
        await BootstrapAsync(ct);
        var normalized = Normalize(email);
        var account = await db.AdminAccounts.FirstOrDefaultAsync(a => a.Email == normalized, ct);
        if (account is null)
        {
            Hasher.VerifyHashedPassword(new AdminAccount(), DummyHash, password ?? "");
            return new SignInResult(await AnyAsync(ct) ? SignInStatus.Wrong : SignInStatus.NoAccount);
        }

        var now = clock.GetUtcNow().UtcDateTime;
        if (account.LockedUntil is { } until && until > now)
            return new SignInResult(SignInStatus.LockedOut, RetryAfter: until - now);

        var result = Verify(account, password);
        if (result == PasswordVerificationResult.Failed)
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

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            account.PasswordHash = Hasher.HashPassword(account, password!);
        account.FailedLoginCount = 0;
        account.LockedUntil = null;
        account.LastLoginAt = now;
        await db.SaveChangesAsync(ct);
        return new SignInResult(SignInStatus.Ok, account);
    }

    /// <summary>Changes the password and the security stamp, which signs out every other session.</summary>
    public async Task<string?> ChangePasswordAsync(AdminAccount account, string? current, string? next, CancellationToken ct = default)
    {
        if (Verify(account, current) == PasswordVerificationResult.Failed) return "Your current password is not correct.";
        if (CheckNewPassword(next) is { } problem) return problem;
        if (next == current) return "Choose a password different from the current one.";
        SetPassword(account, next!);
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
        SetPassword(account!, password);
        await db.SaveChangesAsync(ct);
        return created;
    }

    /// <summary>First run: copies Admin:Email and Admin:PasswordHash from settings into the database.</summary>
    private async Task BootstrapAsync(CancellationToken ct)
    {
        var o = bootstrap.Value;
        if (string.IsNullOrWhiteSpace(o.Email) || string.IsNullOrWhiteSpace(o.PasswordHash) || await AnyAsync(ct)) return;
        db.AdminAccounts.Add(new AdminAccount { Email = Normalize(o.Email), PasswordHash = o.PasswordHash.Trim() });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Another request created it at the same moment.
            db.ChangeTracker.Clear();
        }
    }

    private static PasswordVerificationResult Verify(AdminAccount account, string? password)
    {
        try
        {
            return Hasher.VerifyHashedPassword(account, account.PasswordHash, password ?? "");
        }
        catch (FormatException)
        {
            // A badly pasted hash should read as "wrong password", not crash the sign-in.
            return PasswordVerificationResult.Failed;
        }
    }

    private static void SetPassword(AdminAccount account, string password)
    {
        account.PasswordHash = Hasher.HashPassword(account, password);
        account.SecurityStamp = Guid.NewGuid().ToString("N");
        account.FailedLoginCount = 0;
        account.LockedUntil = null;
    }
}
