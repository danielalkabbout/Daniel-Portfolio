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

/// <param name="Referrer">The referrer of the page the visitor landed on (kept for the whole tab).</param>
/// <param name="Utm">utm_source from the landing address, if any.</param>
/// <param name="Tz">The browser's IANA time zone, used for the country.</param>
/// <param name="Session">Random per-tab id, so one visit's pages stay together.</param>
/// <param name="Seconds">For "time": active seconds spent on the page.</param>
/// <param name="Leaving">For "time": the visitor closed the tab or switched away.</param>
public sealed record TrackRequest(
    string? Kind, string? Path, string? Referrer, string? Ref = null, string? Utm = null, string? Tz = null,
    string? Session = null, int? Seconds = null, bool? Leaving = null);
public sealed record LinkCreate(string? Label, string? Note);

/// <summary>Anonymous visit counts: the site reports page views and CV downloads; the studio reads the totals.</summary>
[ApiController]
public partial class VisitsController(
    AppDbContext db, VisitTracker tracker, IConfiguration config, EmailNotifier email, LiveVisitors live) : ControllerBase
{
    /// <summary>view and cv are saved; time saves seconds spent on a page; ping only updates who's online.</summary>
    private static readonly HashSet<string> Kinds = ["view", "cv", "time", "ping"];
    /// <summary>Longest time one page can count for in one go (4 hours).</summary>
    private const int MaxSeconds = 4 * 3600;
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
        var source = VisitTracker.Source(body.Referrer, ua, body.Utm);
        if (siteHosts.Any(h => h.Length > 0 && string.Equals(source, h, StringComparison.OrdinalIgnoreCase))) source = "Direct";

        var networkCountry = VisitTracker.Country(Request.Headers["X-Visitor-Country"].ToString());
        var org = Request.Headers["X-Visitor-Org"].ToString();
        // Automated browsers in data centres (they run the site's code, so the user agent alone can't tell).
        if (VisitTracker.IsDataCentreVisit(org, networkCountry, body.Tz)) return NoContent();
        var country = VisitTracker.Country(networkCountry, body.Tz);
        var timeZone = TimeZoneCountries.Lookup(body.Tz) is null ? "" : body.Tz!;
        var session = VisitTracker.Session(body.Session);
        var device = VisitTracker.Device(ua);
        var visitor = tracker.VisitorHash(HttpContext.Connection.RemoteIpAddress?.ToString(), ua);

        var code = (body.Ref ?? "").Trim().ToLowerInvariant();
        if (!CodeRegex().IsMatch(code)) code = "";

        // Who's online right now (memory only): the heartbeat, and the end of a visit.
        if (kind == "ping")
        {
            live.Touch(session, path, source, country, device, code);
            return NoContent();
        }
        if (kind == "time")
        {
            var seconds = body.Seconds ?? 0;
            if (body.Leaving == true) live.End(session);
            else live.Touch(session, path, source, country, device, code);
            if (seconds is < 1 or > MaxSeconds || session.Length == 0) return NoContent();
            if (code.Length > 0 && !await db.TrackedLinks.AnyAsync(l => l.Code == code, ct)) code = "";
            db.Visits.Add(new Visit
            {
                At = DateTime.UtcNow, Kind = "time", Path = path, Source = source, Country = country, Device = device,
                Visitor = visitor, Ref = code, Session = session, Seconds = seconds,
                TimeZone = timeZone, NetworkCountry = networkCountry,
            });
            await db.SaveChangesAsync(ct);
            return NoContent();
        }
        live.Touch(session, path, source, country, device, code);

        TrackedLink? link = null;
        if (code.Length > 0)
            link = await db.TrackedLinks.AsNoTracking().FirstOrDefaultAsync(l => l.Code == code, ct);

        // An email for each new visit (one browser tab), from a personal link or the plain address.
        if (kind == "view" && email.WantsVisitAlert(link is not null))
        {
            var today = DateTime.UtcNow.Date;
            var seen = session.Length > 0
                ? await db.Visits.AnyAsync(v => v.Session == session && v.Kind == "view", ct)
                : await db.Visits.AnyAsync(v => v.Visitor == visitor && v.Kind == "view" && v.At >= today, ct);
            if (!seen)
                await email.NotifyVisitAsync(new VisitAlert(
                    link?.Label, path, source, VisitTracker.Channel(source), country, networkCountry, device,
                    VisitTracker.Browser(ua), DateTime.UtcNow), ct);
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
            Session = session,
            TimeZone = timeZone,
            NetworkCountry = networkCountry,
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
            .Select(v => new Row(v.At, v.Kind, v.Path, v.Source, v.Country, v.Device, v.Visitor, v.Ref, v.Session, v.Seconds, v.NetworkCountry, v.TimeZone))
            .ToListAsync(ct);
        var views = rows.Where(r => r.Kind == "view").ToList();
        var times = rows.Where(r => r.Kind == "time").ToList();
        // Where people came from is counted once per visit (one tab), not once per page they opened.
        var visits = Group(rows);
        var timed = visits.Where(v => v.Rows.Any(r => r.Kind == "time")).ToList();

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
            visits = visits.Count,
            // Average active time per visit, over visits that have a timer.
            avgSeconds = timed.Count > 0 ? (int)timed.Average(v => v.Seconds) : 0,
            // Average time on each page, per view of that page.
            pageTime = times.GroupBy(t => t.Path)
                .Select(g => new { name = g.Key, n = (int)(g.Sum(t => t.Seconds) / Math.Max(1, views.Count(v => v.Path == g.Key))) })
                .Where(x => x.n > 0).OrderByDescending(x => x.n).Take(10).ToArray(),
            linkVisits = visits.Count(v => v.Ref.Length > 0),
            sources = Top(visits, v => v.Source, 12),
            channels = Top(visits, v => VisitTracker.Channel(v.Source), 8),
            countries = Top(visits, v => v.Country, 12),
            devices = Top(visits, v => v.Device, 3),
        });
    }

    /// <summary>
    /// What each visitor did, one visit (browser tab) at a time, newest first. <paramref name="kind"/> is
    /// "other" for visits that didn't come through a personal link, "links" for those that did, or "all".
    /// </summary>
    [HttpGet("api/admin/visits/sessions")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Sessions(
        [FromQuery] int days = 30, [FromQuery] string kind = "other", [FromQuery] int take = 100, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 365);
        take = Math.Clamp(take, 1, 300);
        var since = DateTime.UtcNow.Date.AddDays(1 - days);
        var q = db.Visits.AsNoTracking().Where(v => v.At >= since);
        q = kind switch
        {
            "links" => q.Where(v => v.Ref != ""),
            "all" => q,
            _ => q.Where(v => v.Ref == ""),
        };
        var rows = await q.OrderBy(v => v.At)
            .Select(v => new Row(v.At, v.Kind, v.Path, v.Source, v.Country, v.Device, v.Visitor, v.Ref, v.Session, v.Seconds, v.NetworkCountry, v.TimeZone))
            .ToListAsync(ct);
        var all = Group(rows);
        var labels = await db.TrackedLinks.AsNoTracking().ToDictionaryAsync(l => l.Code, l => l.Label, ct);
        return Ok(new
        {
            total = all.Count,
            sessions = all.OrderByDescending(s => s.At).Take(take).Select(s => new
            {
                visit = Describe(s),
                link = s.Ref.Length > 0 && labels.TryGetValue(s.Ref, out var label) ? label : null,
            }),
        });
    }

    private sealed record Row(
        DateTime At, string Kind, string Path, string Source, string Country, string Device, string Visitor, string Ref,
        string Session, int Seconds, string NetworkCountry, string TimeZone);

    private sealed record VisitGroup(
        DateTime At, DateTime LastAt, string Source, string Country, string Device, string Ref, List<Row> Rows,
        int Seconds, string NetworkCountry, string TimeZone);

    /// <summary>
    /// One visit = one browser tab (its random session id). Older rows without one fall back to the same
    /// visitor on the same day. The source, country and device are the ones from the page they landed on.
    /// </summary>
    private static List<VisitGroup> Group(IEnumerable<Row> rows) => rows
        .OrderBy(r => r.At)
        .GroupBy(r => r.Session.Length > 0 ? "s:" + r.Session : $"v:{r.Visitor}:{DateOnly.FromDateTime(r.At)}:{r.Ref}")
        .Select(g =>
        {
            var list = g.ToList();
            var first = list.FirstOrDefault(r => r.Kind == "view") ?? list[0];
            var seconds = list.Where(r => r.Kind == "time").Sum(r => r.Seconds);
            // Older visits have no timer; fall back to the time between their first and last page.
            if (seconds == 0) seconds = (int)Math.Min(MaxSeconds, (list[^1].At - list[0].At).TotalSeconds);
            return new VisitGroup(list[0].At, list[^1].At, first.Source, first.Country, first.Device,
                list.Select(r => r.Ref).FirstOrDefault(r => r.Length > 0) ?? "", list, seconds,
                first.NetworkCountry, first.TimeZone);
        })
        .Where(v => v.Rows.Any(r => r.Kind is "view" or "cv"))
        .ToList();

    private sealed record Step(DateTime At, string Kind, string Path)
    {
        public int Seconds { get; set; }
    }

    /// <summary>Every page in order with the time spent on it; a page opened twice in a row counts once.</summary>
    private static List<Step> Steps(List<Row> rows)
    {
        var steps = new List<Step>();
        foreach (var r in rows)
        {
            if (r.Kind == "time")
            {
                // Time arrives when the visitor moves on, so it belongs to the latest visit of that page.
                var step = steps.LastOrDefault(x => x.Kind == "view" && x.Path == r.Path);
                if (step is not null) step.Seconds += r.Seconds;
                continue;
            }
            if (steps.Count > 0 && steps[^1].Kind == r.Kind && steps[^1].Path == r.Path) continue;
            steps.Add(new Step(r.At, r.Kind, r.Path));
        }
        return steps;
    }

    private static object Describe(VisitGroup s) => new
    {
        at = s.At,
        lastAt = s.LastAt,
        seconds = s.Seconds,
        source = s.Source,
        channel = VisitTracker.Channel(s.Source),
        country = s.Country,
        // The network's own country when it differs (a VPN, iCloud Private Relay, a carrier routing abroad).
        networkCountry = s.NetworkCountry.Length > 0 && s.NetworkCountry != s.Country ? s.NetworkCountry : "",
        timeZone = s.TimeZone,
        device = s.Device,
        steps = Steps(s.Rows).Select(x => new { at = x.At, kind = x.Kind, path = x.Path, seconds = x.Seconds }).ToList(),
        pages = s.Rows.Where(r => r.Kind == "view").Select(r => r.Path).ToList(),
        cv = s.Rows.Any(r => r.Kind == "cv"),
    };

    /// <summary>Who is on the site right now, with when their visit started (for a live timer).</summary>
    [HttpGet("api/admin/visits/live")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Live(CancellationToken ct)
    {
        var now = live.Now();
        var codes = now.Select(v => v.Ref).Where(r => r.Length > 0).Distinct().ToList();
        var labels = codes.Count == 0
            ? []
            : await db.TrackedLinks.AsNoTracking().Where(l => codes.Contains(l.Code)).ToDictionaryAsync(l => l.Code, l => l.Label, ct);
        return Ok(new
        {
            serverTime = DateTime.UtcNow,
            visitors = now.Select(v => new
            {
                startedAt = v.StartedAt,
                lastSeen = v.LastSeen,
                path = v.Path,
                source = v.Source,
                channel = VisitTracker.Channel(v.Source),
                country = v.Country,
                device = v.Device,
                link = v.Ref.Length > 0 && labels.TryGetValue(v.Ref, out var label) ? label : null,
            }),
        });
    }

    /// <summary>Deletes every recorded visit (personal links stay). For starting fresh.</summary>
    [HttpDelete("api/admin/visits")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reset(CancellationToken ct)
    {
        var n = await db.Visits.ExecuteDeleteAsync(ct);
        return Ok(new { deleted = n });
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
            .Select(v => new Row(v.At, v.Kind, v.Path, v.Source, v.Country, v.Device, v.Visitor, v.Ref, v.Session, v.Seconds, v.NetworkCountry, v.TimeZone))
            .ToListAsync(ct);

        return Ok(links.Select(l =>
        {
            var mine = visits.Where(v => v.Ref == l.Code).ToList();
            var sessions = Group(mine).OrderByDescending(x => x.At).Take(20).Select(Describe).ToList();
            return new
            {
                l.Id, l.Code, l.Label, l.Note, l.CreatedAt,
                visits = mine.Count(v => v.Kind == "view"),
                seconds = Group(mine).Sum(g => g.Seconds),
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
