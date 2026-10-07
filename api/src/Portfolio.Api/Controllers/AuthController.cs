using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AdminAccounts accounts, TokenService tokens, AuditWriter audit) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> Login(LoginRequest body, CancellationToken ct)
    {
        var result = await accounts.SignInAsync(body.Email, body.Password, ct);
        switch (result.Status)
        {
            case SignInStatus.NoAccount:
                return Problem(statusCode: 503, title: "No admin account yet",
                    detail: "Create one with: dotnet run --project src/Portfolio.Api -- create-admin");
            case SignInStatus.LockedOut:
                var minutes = (int)Math.Ceiling((result.RetryAfter ?? AdminAccounts.LockoutTime).TotalMinutes);
                return Problem(statusCode: 429, title: "Too many failed sign-ins",
                    detail: $"Sign-in is locked for {minutes} minute{(minutes == 1 ? "" : "s")}. Try again later.");
            case SignInStatus.Wrong:
                return Problem(statusCode: 401, title: "Wrong email or password");
        }

        var account = result.Account!;
        await audit.WriteAsync("login", "admin", account.Id.ToString(), ct: ct);
        var (token, expiresAt) = tokens.Create(account);
        return Ok(new LoginResponse(token, expiresAt));
    }

    [HttpGet("me")]
    [Authorize(Roles = "admin")]
    public IActionResult Me() => Ok(new { email = HttpContext.User.FindFirst("sub")?.Value });

    /// <summary>Changes the studio password. Other signed-in sessions stop working; this one gets a new token.</summary>
    [HttpPost("change-password")]
    [Authorize(Roles = "admin")]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest body, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst(TokenService.AccountIdClaim)?.Value, out var id)
            || await accounts.FindAsync(id, ct) is not { } account)
            return Unauthorized();

        if (await accounts.ChangePasswordAsync(account, body.CurrentPassword, body.NewPassword, ct) is { } problem)
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["Password"] = [problem] }));

        await audit.WriteAsync("password", "admin", account.Id.ToString(), ct: ct);
        var (token, expiresAt) = tokens.Create(account);
        return Ok(new LoginResponse(token, expiresAt));
    }

    public static string HashPassword(string password) => AdminAccounts.Hash(password);
}
