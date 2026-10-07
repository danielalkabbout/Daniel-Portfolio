using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Portfolio.Api.Contracts;
using Portfolio.Api.Options;
using Portfolio.Api.Services;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IOptions<AdminOptions> admin, TokenService tokens) : ControllerBase
{
    private static readonly PasswordHasher<object> Hasher = new();
    private static readonly object AdminUser = new();

    [HttpPost("login")]
    [EnableRateLimiting("strict")]
    public IActionResult Login(LoginRequest body)
    {
        var o = admin.Value;
        if (string.IsNullOrWhiteSpace(o.Email) || string.IsNullOrWhiteSpace(o.PasswordHash))
            return Problem(statusCode: 503, title: "Admin login is not configured");

        // Always check the password, so a wrong email takes as long as a wrong password.
        var passwordOk = Hasher.VerifyHashedPassword(AdminUser, o.PasswordHash, body.Password ?? "") != PasswordVerificationResult.Failed;
        var emailOk = string.Equals(body.Email?.Trim(), o.Email, StringComparison.OrdinalIgnoreCase);
        if (!passwordOk || !emailOk)
            return Problem(statusCode: 401, title: "Wrong email or password");

        var (token, expiresAt) = tokens.Create(o.Email);
        return Ok(new LoginResponse(token, expiresAt));
    }

    [HttpGet("me")]
    [Authorize(Roles = "admin")]
    public IActionResult Me() => Ok(new { email = HttpContext.User.FindFirst("sub")?.Value });

    public static string HashPassword(string password) => Hasher.HashPassword(AdminUser, password);
}
