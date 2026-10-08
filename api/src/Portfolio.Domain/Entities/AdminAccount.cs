using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>
/// The studio sign-in. The password itself is never stored or sent: the account keeps an SRP salt and
/// verifier, and the browser proves it knows the password without revealing it.
/// </summary>
public class AdminAccount : IAuditable
{
    public int Id { get; set; }

    /// <summary>Stored lower-case so sign-in ignores letter case.</summary>
    public string Email { get; set; } = "";

    /// <summary>Random SRP salt, hex.</summary>
    public string SrpSalt { get; set; } = "";

    /// <summary>SRP verifier v = g^x mod N, hex. Can check a proof, but can't be used to sign in.</summary>
    public string SrpVerifier { get; set; } = "";

    /// <summary>Changes with every password change; tokens issued before that stop working.</summary>
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");

    public int FailedLoginCount { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
