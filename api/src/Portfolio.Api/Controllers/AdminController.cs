using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Portfolio.Api.Contracts;
using Portfolio.Api.Services;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Content;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

/// <summary>Everything the content studio needs. Every endpoint requires an admin token.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(
    AppDbContext db,
    ContentService content,
    AuditWriter audit,
    IValidator<SiteContentDto> validator,
    IOutputCacheStore outputCache,
    IMemoryCache memory,
    EmailNotifier email) : ControllerBase
{
    /// <summary>Whether new requests are emailed to you, and where.</summary>
    [HttpGet("notifications")]
    public IActionResult GetNotifications() => Ok(new { email = email.IsConfigured, to = email.MaskedTo });

    /// <summary>Sends a test email so you can check the setup from the studio.</summary>
    [HttpPost("notifications/test")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("strict")]
    public async Task<IActionResult> TestNotification(CancellationToken ct)
    {
        if (!email.IsConfigured)
            return Problem(statusCode: 503, title: "Email is not set up",
                detail: "Add Email__ResendApiKey and Email__To to the API's environment, then try again.");
        if (!await email.SendTestAsync(ct))
            return Problem(statusCode: 502, title: "The test email could not be sent",
                detail: "Resend refused it. Check the API key, and that the address is the one your Resend account uses.");
        await audit.WriteAsync("test", "email", ct: ct);
        return Ok(new { sent = true });
    }

    [HttpGet("content")]
    public async Task<IActionResult> GetContent(CancellationToken ct) =>
        await content.GetAsync(ct) is { } site ? Ok(site) : Ok(new SiteContentDto());

    /// <summary>Replaces all portfolio content. The studio sends the whole document when you press Save.</summary>
    [HttpPut("content")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> SaveContent(SiteContentDto body, CancellationToken ct)
    {
        var result = await validator.ValidateAsync(body, ct);
        if (!result.IsValid) return ValidationProblem(new ValidationProblemDetails(result.ToDictionary()));

        var changed = await content.ReplaceAsync(body, ct);
        if (changed.Count > 0)
        {
            await audit.WriteAsync("update", "content", details: string.Join(", ", changed), ct: ct);
            await outputCache.EvictByTagAsync(ContentController.CacheTag, ct);
            memory.Remove(EchoAssistant.FactsCacheKey);
        }

        return Ok(new { changed, content = await content.GetAsync(ct) });
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests([FromQuery] string? status, CancellationToken ct)
    {
        var query = db.ServiceRequests.AsNoTracking();
        if (Enum.TryParse<ServiceRequestStatus>(status, ignoreCase: true, out var s))
            query = query.Where(r => r.Status == s);
        var items = await query.OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct);
        return Ok(items.Select(r => new
        {
            r.Id, r.Name, r.Email, r.Company, r.Services, r.Timeline, r.Message,
            Status = r.Status.ToString(), r.CreatedAt,
        }));
    }

    [HttpPatch("requests/{id:int}")]
    public async Task<IActionResult> UpdateRequest(int id, ServiceRequestStatusUpdate body, CancellationToken ct)
    {
        if (!Enum.TryParse<ServiceRequestStatus>(body.Status, ignoreCase: true, out var status))
            return Problem(statusCode: 400, title: "Unknown status", detail: "Use New, Read, Replied or Archived.");
        var request = await db.ServiceRequests.FindAsync([id], ct);
        if (request is null) return NotFound();
        request.Status = status;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("status", "request", id.ToString(), status.ToString(), ct);
        return NoContent();
    }

    [HttpDelete("requests/{id:int}")]
    public async Task<IActionResult> DeleteRequest(int id, CancellationToken ct)
    {
        var deleted = await db.ServiceRequests.Where(r => r.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) return NotFound();
        await audit.WriteAsync("delete", "request", id.ToString(), ct: ct);
        return NoContent();
    }

    /// <summary>Uploads an image (PNG, JPG, WebP or GIF, up to 5 MB) and returns its public URL.</summary>
    [HttpPost("media")]
    [RequestSizeLimit(MediaStorage.MaxBytes + 64 * 1024)]
    public async Task<IActionResult> UploadMedia(IFormFile file, [FromServices] MediaStorage storage, CancellationToken ct)
    {
        if (!storage.IsConfigured)
            return Problem(statusCode: 503, title: "Image storage is not configured");
        if (file.Length is 0 or > MediaStorage.MaxBytes)
            return Problem(statusCode: 400, title: "Choose an image up to 5 MB");
        if (!MediaStorage.IsAllowedType(file.ContentType))
            return Problem(statusCode: 400, title: "Use a PNG, JPG, WebP or GIF image");

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        if (!MediaStorage.LooksLikeImage(stream.GetBuffer().AsSpan(0, (int)Math.Min(stream.Length, 16)), file.ContentType))
            return Problem(statusCode: 400, title: "That file is not a valid image");

        stream.Position = 0;
        var url = await storage.UploadAsync(stream, file.ContentType, ct);
        await audit.WriteAsync("upload", "media", details: url, ct: ct);
        return Ok(new { url });
    }

    /// <summary>Rebuilds the public site on Cloudflare Pages so it shows the latest content.</summary>
    [HttpPost("publish")]
    public async Task<IActionResult> Publish([FromServices] DeployHook hook, CancellationToken ct)
    {
        if (!hook.IsConfigured)
            return Problem(statusCode: 503, title: "Publishing is not configured",
                detail: "Set Pages:DeployHookUrl to your Cloudflare Pages deploy hook.");
        if (!await hook.TriggerAsync(ct))
            return Problem(statusCode: 502, title: "Cloudflare did not accept the rebuild");
        await audit.WriteAsync("publish", "site", ct: ct);
        return Accepted(new { message = "Rebuild started. The site updates in about a minute." });
    }

    [HttpGet("audit")]
    public async Task<IActionResult> GetAudit([FromQuery] int take = 50, CancellationToken ct = default) =>
        Ok(await db.AuditLogs.AsNoTracking().OrderByDescending(a => a.At).Take(Math.Clamp(take, 1, 200)).ToListAsync(ct));
}
