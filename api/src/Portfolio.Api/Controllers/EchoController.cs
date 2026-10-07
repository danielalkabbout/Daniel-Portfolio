using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;

namespace Portfolio.Api.Controllers;

/// <summary>AI answers for Echo. Returns 503 when unavailable so the site falls back to built-in answers.</summary>
[ApiController]
[Route("api/echo")]
public class EchoController(EchoAssistant echo, IValidator<EchoRequest> validator) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("echo")]
    public async Task<IActionResult> Ask(EchoRequest body, CancellationToken ct)
    {
        var result = await validator.ValidateAsync(body, ct);
        if (!result.IsValid) return ValidationProblem(new ValidationProblemDetails(result.ToDictionary()));

        if (!echo.IsConfigured)
            return Problem(statusCode: 503, title: "Echo AI is not configured");

        var answer = await echo.AskAsync(body, ct);
        return answer is null
            ? Problem(statusCode: 503, title: "Echo AI is unavailable right now")
            : Ok(new EchoResponse(answer));
    }
}
