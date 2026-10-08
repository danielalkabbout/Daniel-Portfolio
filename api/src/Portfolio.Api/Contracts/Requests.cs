namespace Portfolio.Api.Contracts;

/// <summary>Step 1 of the SRP sign-in: a fingerprint of the email (see Srp.LoginId), never the email itself.</summary>
public sealed record ChallengeRequest(string Id);

/// <summary>Step 2: the browser's public value A and its one-time proof M1. No password.</summary>
public sealed record LoginRequest(string ChallengeId, string A, string M1);

/// <summary>Sign-in result. M2 is the server's proof, so the browser knows it reached the real server.</summary>
public sealed record LoginResponse(string Email, DateTime ExpiresAt, string M2);

/// <summary>What the studio learns about its session. The token itself stays in an HttpOnly cookie.</summary>
public sealed record SessionResponse(string Email, DateTime ExpiresAt);

public sealed class ServiceRequestCreate
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Company { get; set; } = "";
    public List<string> Services { get; set; } = [];
    public string Timeline { get; set; } = "";
    public string Message { get; set; } = "";
    public string TurnstileToken { get; set; } = "";
    /// <summary>Hidden field humans never fill in. If it has a value, the request is from a bot.</summary>
    public string Website { get; set; } = "";
}

public sealed record ServiceRequestStatusUpdate(string Status);

public sealed class EchoRequest
{
    public string Question { get; set; } = "";
    public List<EchoTurn> History { get; set; } = [];
}

public sealed record EchoTurn(string Role, string Content);

public sealed record EchoResponse(string Answer);

/// <summary>A proof of the current password (fresh challenge) plus the new salt and verifier made in the browser.</summary>
public sealed record ChangePasswordRequest(string ChallengeId, string A, string M1, string Salt, string Verifier);
