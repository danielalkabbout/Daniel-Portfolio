using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>The studio sign-in. Passwords are stored only as ASP.NET Core Identity hashes.</summary>
public class AdminAccount : IAuditable
{
    public int Id { get; set; }

    /// <summary>Stored lower-case so sign-in ignores letter case.</summary>
    public string Email { get; set; } = "";

    public string PasswordHash { get; set; } = "";

    /// <summary>Changes with every password change; tokens issued before that stop working.</summary>
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");

    public int FailedLoginCount { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
