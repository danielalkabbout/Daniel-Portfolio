using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

/// <summary>The request form on the Services page.</summary>
[ApiController]
[Route("api/requests")]
public class RequestsController(
    AppDbContext db,
    IValidator<ServiceRequestCreate> validator,
    TurnstileVerifier turnstile,
    EmailNotifier email) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("strict")]
    public async Task<IActionResult> Create(ServiceRequestCreate body, CancellationToken ct)
    {
        // Bots fill every field, including the hidden one. Pretend it worked.
        if (!string.IsNullOrWhiteSpace(body.Website))
            return StatusCode(StatusCodes.Status201Created, new { id = 0 });

        var result = await validator.ValidateAsync(body, ct);
        if (!result.IsValid) return ValidationProblem(new ValidationProblemDetails(result.ToDictionary()));

        if (!await turnstile.VerifyAsync(body.TurnstileToken, HttpContext.Connection.RemoteIpAddress?.ToString(), ct))
            return Problem(statusCode: 400, title: "Bot check failed", detail: "Refresh the page and try sending the request again.");

        var request = new ServiceRequest
        {
            Name = body.Name.Trim(),
            Email = body.Email.Trim(),
            Company = body.Company.Trim(),
            Services = body.Services.Select(s => s.Trim()).Where(s => s.Length > 0).Distinct().ToList(),
            Timeline = body.Timeline.Trim(),
            Message = body.Message.Trim(),
        };
        db.ServiceRequests.Add(request);
        await db.SaveChangesAsync(ct);

        await email.NotifyNewRequestAsync(request, ct);

        return StatusCode(StatusCodes.Status201Created, new { id = request.Id });
    }
}
