using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Services;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Api.Controllers;

public sealed record TrackRequest(string? Kind, string? Path, string? Referrer, string? Ref = null);
public sealed record LinkCreate(string? Label, string? Note);

/// <summary>Anonymous visit counts: the site reports page views and CV downloads; the studio reads the totals.</summary>
[ApiController]
public partial class VisitsController(AppDbContext db, VisitTracker tracker, IConfiguration config, EmailNotifier email) : ControllerBase
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

        var country = VisitTracker.Country(Request.Headers["X-Visitor-Country"].ToString());
        var device = VisitTracker.Device(ua);
        var visitor = tracker.VisitorHash(HttpContext.Connection.RemoteIpAddress?.ToString(), ua);

        // A personal link: keep its code, and email you the first time that person opens the site each day.
        var code = (body.Ref ?? "").Trim().ToLowerInvariant();
        TrackedLink? link = null;
        if (CodeRegex().IsMatch(code))
            link = await db.TrackedLinks.AsNoTracking().FirstOrDefaultAsync(l => l.Code == code, ct);
        if (link is not null)
        {
            var today = DateTime.UtcNow.Date;
            var seenToday = await db.Visits.AnyAsync(v => v.Ref == link.Code && v.Visitor == visitor && v.At >= today, ct);
            if (!seenToday) await email.NotifyLinkOpenedAsync(link.Label, path, country, device, ct);
        }

        db.Visits.Add(new Visit
        {
            Ref = link?.Code ?? "",
            At = DateTime.UtcNow,
            Kind = kind,
            Path = path,
            Source = source,
            Country = country,
            Device = device,
            Visitor = visitor,
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
            today = views.Where(v => v.At >= DateTime.UtcNow.Date).Select(v => v.Visitor).Distinct().Count(),
            perDay,
            pages = Top(views, v => v.Path, 10),
            projects = Top(views.Where(v => v.Path.StartsWith("/projects/")), v => v.Path["/projects/".Length..], 10),
            sources = Top(views, v => v.Source, 8),
            countries = Top(views, v => v.Country, 10),
            devices = Top(views, v => v.Device, 3),
        });
    }

    [GeneratedRegex("^[a-z0-9]{4,12}$")]
    private static partial Regex CodeRegex();

    private const string CodeAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    /// <summary>Your personal links, each with who opened it, when, and what they looked at.</summary>
    [HttpGet("api/admin/links")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Links(CancellationToken ct)
    {
        var links = await db.TrackedLinks.AsNoTracking().OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        var codes = links.Select(l => l.Code).ToList();
        var visits = await db.Visits.AsNoTracking().Where(v => codes.Contains(v.Ref))
            .OrderBy(v => v.At)
            .Select(v => new { v.Ref, v.At, v.Kind, v.Path, v.Source, v.Country, v.Device, v.Visitor })
            .ToListAsync(ct);

        return Ok(links.Select(l =>
        {
            var mine = visits.Where(v => v.Ref == l.Code).ToList();
            // One "session" = one visitor on one day: what they did, in order.
            var sessions = mine
                .GroupBy(v => (v.Visitor, Day: DateOnly.FromDateTime(v.At)))
                .Select(g => new
                {
                    at = g.First().At,
                    lastAt = g.Last().At,
                    device = g.First().Device,
                    country = g.First().Country,
                    source = g.First().Source,
                    pages = g.Where(v => v.Kind == "view").Select(v => v.Path).ToList(),
                    cv = g.Any(v => v.Kind == "cv"),
                })
                .OrderByDescending(x => x.at).Take(20).ToList();
            return new
            {
                l.Id, l.Code, l.Label, l.Note, l.CreatedAt,
                visits = mine.Count(v => v.Kind == "view"),
                sessions = sessions.Count,
                cv = mine.Any(v => v.Kind == "cv"),
                lastAt = mine.Count > 0 ? mine[^1].At : (DateTime?)null,
                history = sessions,
            };
        }));
    }

    [HttpPost("api/admin/links")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateLink(LinkCreate body, CancellationToken ct)
    {
        var label = (body.Label ?? "").Trim();
        var note = (body.Note ?? "").Trim();
        if (label.Length is 0 or > 80 || note.Length > 200)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["Label"] = ["Name the company or person, in up to 80 characters."],
            }));

        string code;
        do code = RandomNumberGenerator.GetString(CodeAlphabet, 6);
        while (await db.TrackedLinks.AnyAsync(l => l.Code == code, ct));

        var link = new TrackedLink { Code = code, Label = label, Note = note, CreatedAt = DateTime.UtcNow };
        db.TrackedLinks.Add(link);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, new { link.Id, link.Code, link.Label, link.Note, link.CreatedAt });
    }

    /// <summary>Deletes the link. Its past visits stay in your totals.</summary>
    [HttpDelete("api/admin/links/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteLink(int id, CancellationToken ct) =>
        await db.TrackedLinks.Where(l => l.Id == id).ExecuteDeleteAsync(ct) > 0 ? NoContent() : NotFound();
}
