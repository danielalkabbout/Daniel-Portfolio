using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Services;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

public sealed record TrackRequest(string? Kind, string? Path, string? Referrer);

/// <summary>Anonymous visit counts: the site reports page views and CV downloads; the studio reads the totals.</summary>
[ApiController]
public class VisitsController(AppDbContext db, VisitTracker tracker, IConfiguration config) : ControllerBase
{
    private static readonly HashSet<string> Kinds = ["view", "cv"];
    /// <summary>Visits are kept for about 13 months, then removed.</summary>
    public static readonly TimeSpan Keep = TimeSpan.FromDays(400);

    [HttpPost("api/track")]
    [EnableRateLimiting("track")]
    public async Task<IActionResult> Track(TrackRequest body, CancellationToken ct)
    {
        var ua = Request.Headers.UserAgent.ToString();
        // Not counted: bots, the studio owner (signed-in cookie), and anything that isn't a real page.
        if (VisitTracker.IsBot(ua) || Request.Cookies.ContainsKey(SessionCookie.Name)) return NoContent();
        var kind = (body.Kind ?? "view").ToLowerInvariant();
        if (!Kinds.Contains(kind) || VisitTracker.CleanPath(body.Path) is not { } path) return NoContent();

        var siteHosts = (config.GetSection("Cors:Origins").Get<string[]>() ?? [])
            .Select(o => Uri.TryCreate(o, UriKind.Absolute, out var u) ? u.Host : "")
            .Append("danielalkabbout.pages.dev");
        var source = VisitTracker.Source(body.Referrer, null);
        if (siteHosts.Any(h => h.Length > 0 && string.Equals(source, h, StringComparison.OrdinalIgnoreCase))) source = "Direct";

        db.Visits.Add(new Visit
        {
            At = DateTime.UtcNow,
            Kind = kind,
            Path = path,
            Source = source,
            Country = VisitTracker.Country(Request.Headers["X-Visitor-Country"].ToString()),
            Device = VisitTracker.Device(ua),
            Visitor = tracker.VisitorHash(HttpContext.Connection.RemoteIpAddress?.ToString(), ua),
        });
        await db.SaveChangesAsync(ct);

        // Now and then, drop visits older than the retention period.
        if (Random.Shared.Next(200) == 0)
        {
            var cutoff = DateTime.UtcNow - Keep;
            await db.Visits.Where(v => v.At < cutoff).ExecuteDeleteAsync(ct);
        }
        return NoContent();
    }

    /// <summary>Totals for the studio's Visitors tab, for the last <paramref name="days"/> days.</summary>
    [HttpGet("api/admin/visits")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Stats([FromQuery] int days = 30, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 365);
        var since = DateTime.UtcNow.Date.AddDays(1 - days);
        var rows = await db.Visits.AsNoTracking().Where(v => v.At >= since)
            .Select(v => new { v.At, v.Kind, v.Path, v.Source, v.Country, v.Device, v.Visitor })
            .ToListAsync(ct);
        var views = rows.Where(r => r.Kind == "view").ToList();

        static object[] Top<T>(IEnumerable<T> items, Func<T, string> key, int take) => items
            .GroupBy(key).Where(g => g.Key.Length > 0)
            .Select(g => new { name = g.Key, n = g.Count() })
            .OrderByDescending(x => x.n).ThenBy(x => x.name).Take(take).Cast<object>().ToArray();

        var perDay = Enumerable.Range(0, days).Select(i => DateOnly.FromDateTime(since.AddDays(i))).Select(d => new
        {
            date = d.ToString("yyyy-MM-dd"),
            views = views.Count(v => DateOnly.FromDateTime(v.At) == d),
            visitors = views.Where(v => DateOnly.FromDateTime(v.At) == d).Select(v => v.Visitor).Distinct().Count(),
        });

        return Ok(new
        {
            days,
            views = views.Count,
            // A visitor hash changes daily, so unique visitors are counted per day and added up.
            visitors = views.GroupBy(v => DateOnly.FromDateTime(v.At)).Sum(g => g.Select(v => v.Visitor).Distinct().Count()),
            cvDownloads = rows.Count(r => r.Kind == "cv"),
            perDay,
            pages = Top(views, v => v.Path, 10),
            projects = Top(views.Where(v => v.Path.StartsWith("/projects/")), v => v.Path["/projects/".Length..], 10),
            sources = Top(views, v => v.Source, 8),
            countries = Top(views, v => v.Country, 10),
            devices = Top(views, v => v.Device, 3),
        });
    }
}
