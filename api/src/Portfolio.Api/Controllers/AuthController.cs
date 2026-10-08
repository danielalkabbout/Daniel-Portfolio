using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

/// <summary>
/// Studio sign-in with SRP: the password and the email never leave the browser. See Srp.cs for the maths and
/// web/src/features/admin/srp.ts for the browser half.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(AdminAccounts accounts, TokenService tokens, AuditWriter audit) : ControllerBase
{
    private const string NoAccountHelp =
        "Create the studio account with: dotnet run --project src/Portfolio.Api -- create-admin";

    /// <summary>Step 1: the salt and the server's public value for this email fingerprint.</summary>
    [HttpPost("challenge")]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> Challenge(ChallengeRequest body, CancellationToken ct) =>
        await accounts.ChallengeAsync(body.Id, ct) is { } challenge
            ? Ok(challenge)
            : Problem(statusCode: 503, title: "No studio account yet", detail: NoAccountHelp);

    /// <summary>Step 2: checks the proof and starts a session in an HttpOnly cookie.</summary>
    [HttpPost("login")]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> Login(LoginRequest body, CancellationToken ct)
    {
        var result = await accounts.SignInAsync(body.ChallengeId, body.A, body.M1, ct);
        switch (result.Status)
        {
            case SignInStatus.NoAccount:
                return Problem(statusCode: 503, title: "No studio account yet", detail: NoAccountHelp);
            case SignInStatus.Expired:
                return Problem(statusCode: 401, title: "Sign-in timed out", detail: "That took too long. Sign in again.");
            case SignInStatus.LockedOut:
                var minutes = (int)Math.Ceiling((result.RetryAfter ?? AdminAccounts.LockoutTime).TotalMinutes);
                return Problem(statusCode: 429, title: "Too many failed sign-ins",
                    detail: $"Sign-in is locked for {minutes} minute{(minutes == 1 ? "" : "s")}. Try again later.");
            case SignInStatus.Wrong:
                return Problem(statusCode: 401, title: "Wrong email or password");
        }

        var account = result.Account!;
        await audit.WriteAsync("login", "admin", account.Id.ToString(), ct: ct);
        var expiresAt = StartSession(account);
        return Ok(new LoginResponse(account.Email, expiresAt, result.ServerProof!));
    }

    /// <summary>Who is signed in. The studio calls this on load, since scripts can't read the session cookie.</summary>
    [HttpGet("me")]
    [Authorize(Roles = "admin")]
    public IActionResult Me()
    {
        var exp = long.TryParse(User.FindFirst("exp")?.Value, out var s) ? DateTimeOffset.FromUnixTimeSeconds(s).UtcDateTime : DateTime.UtcNow;
        return Ok(new SessionResponse(User.FindFirst("sub")?.Value ?? "", exp));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        SessionCookie.Clear(HttpContext);
        return NoContent();
    }

    /// <summary>
    /// Changes the studio password. The browser proves the current password and sends the new salt and verifier;
    /// neither password reaches the server. Other signed-in sessions stop working; this one gets a new cookie.
    /// </summary>
    [HttpPost("change-password")]
    [Authorize(Roles = "admin")]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest body, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst(TokenService.AccountIdClaim)?.Value, out var id)
            || await accounts.FindAsync(id, ct) is not { } account)
            return Unauthorized();

        if (await accounts.ChangePasswordAsync(account, body.ChallengeId, body.A, body.M1, body.Salt, body.Verifier, ct) is { } problem)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["Password"] = [problem] }));

        await audit.WriteAsync("password", "admin", account.Id.ToString(), ct: ct);
        var expiresAt = StartSession(account);
        return Ok(new SessionResponse(account.Email, expiresAt));
    }

    /// <summary>Puts a fresh token in the HttpOnly cookie. The response body never contains it.</summary>
    private DateTime StartSession(AdminAccount account)
    {
        var (token, expiresAt) = tokens.Create(account);
        SessionCookie.Write(HttpContext, token);
        return expiresAt;
    }
}
