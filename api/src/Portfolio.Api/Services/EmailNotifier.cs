using System.Net;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;
using Portfolio.Domain.Entities;

namespace Portfolio.Api.Services;

/// <summary>
/// Emails you every request sent from the site (services form and "Request the code"), and each new
/// visit, through Resend.
/// The request is always saved to the database first, so a failed email never loses it.
/// Does nothing until Email:ResendApiKey and Email:To are set.
/// </summary>
/// <summary>What a visit email says about one visit.</summary>
public sealed record VisitAlert(
    string? LinkLabel, string Path, string Source, string Channel, string Country, string NetworkCountry,
    string Device, string Browser, DateTime At);

public class EmailNotifier(HttpClient http, IOptions<EmailOptions> options, ILogger<EmailNotifier> logger)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(options.Value.ResendApiKey) && !string.IsNullOrWhiteSpace(options.Value.To);

    /// <summary>The address emails go to, partly hidden ("d•••@gmail.com"), for the studio.</summary>
    public string MaskedTo
    {
        get
        {
            var to = options.Value.To.Trim();
            var at = to.IndexOf('@');
            return at < 1 ? "" : $"{to[0]}•••{to[at..]}";
        }
    }

    public async Task<bool> NotifyNewRequestAsync(ServiceRequest r, CancellationToken ct)
    {
        if (!IsConfigured) return false;

        var services = string.Join(", ", r.Services);
        var codeAccess = r.Services.Contains("Code access", StringComparer.OrdinalIgnoreCase);
        var subject = codeAccess ? $"Code access request from {r.Name}" : $"New request from {r.Name}: {services}";

        var rows = new List<(string Label, string Value)>
        {
            ("Name", r.Name),
            ("Email", r.Email),
            ("Company", r.Company),
            ("Services", services),
            ("Timeline", r.Timeline),
            ("Received", r.CreatedAt.ToString("dd MMM yyyy, HH:mm 'UTC'")),
        };
        rows.RemoveAll(x => string.IsNullOrWhiteSpace(x.Value));

        var text =
            string.Join("\n", rows.Select(x => $"{x.Label}: {x.Value}")) +
            $"\n\n{r.Message}\n\nReply to this email to answer {r.Name} directly.\nAll requests: {options.Value.StudioUrl}";

        var html =
            "<div style=\"font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#0b1324\">" +
            $"<h2 style=\"margin:0 0 4px;font-size:20px\">{Enc(subject)}</h2>" +
            "<p style=\"margin:0 0 16px;color:#5b6b82;font-size:14px\">Sent from your portfolio. It is also saved in the studio.</p>" +
            "<table style=\"border-collapse:collapse;font-size:14px;margin-bottom:16px\">" +
            string.Concat(rows.Select(x =>
                $"<tr><td style=\"padding:4px 16px 4px 0;color:#5b6b82;vertical-align:top\">{Enc(x.Label)}</td>" +
                $"<td style=\"padding:4px 0\">{Enc(x.Value)}</td></tr>")) +
            "</table>" +
            $"<div style=\"white-space:pre-wrap;background:#f2f6fc;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.5\">{Enc(r.Message)}</div>" +
            $"<p style=\"font-size:14px;margin:18px 0 0\">Reply to this email to answer {Enc(r.Name)} directly, or " +
            $"<a href=\"{Enc(options.Value.StudioUrl)}\" style=\"color:#1c6fd1\">open your requests</a>.</p></div>";

        return await SendAsync(subject, text, html, replyTo: r.Email, ct, $"request {r.Id}");
    }

    /// <summary>"Tradias opened your portfolio": sent the first time a personal link is opened each day.</summary>
    private static readonly Lock alertGate = new();
    private static DateOnly alertDay;
    private static int alertCount;

    /// <summary>Whether a visit should be emailed, from the Email:VisitAlerts setting.</summary>
    public bool WantsVisitAlert(bool personalLink) =>
        IsConfigured && (options.Value.VisitAlerts ?? "all").Trim().ToLowerInvariant() switch
        {
            "off" or "none" => false,
            "links" => personalLink,
            _ => true,
        };

    /// <summary>
    /// Emails you when someone opens the site, once per visit, with where they came from, where they are,
    /// their device and the page they landed on. Capped per day so a busy day can't use up the email quota:
    /// at the cap you get one last email saying so, and alerts start again the next day.
    /// </summary>
    public Task<bool> NotifyVisitAsync(VisitAlert a, CancellationToken ct)
    {
        if (!IsConfigured) return Task.FromResult(false);
        var cap = Math.Max(1, options.Value.VisitAlertsPerDay);
        int n;
        lock (alertGate)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (alertDay != today) (alertDay, alertCount) = (today, 0);
            n = ++alertCount;
        }
        if (n > cap + 1) return Task.FromResult(false);
        if (n == cap + 1)
            return SendAsync(
                "Lots of visitors today: visit emails paused",
                $"Your portfolio has had more than {cap} visits today, so visit emails are paused until tomorrow. Every visit is still recorded in the studio: {options.Value.StudioUrl}",
                $"<p style=\"font-family:system-ui,sans-serif\">Your portfolio has had more than {cap} visits today, so visit emails are paused until tomorrow. Every visit is still recorded in the <a href=\"{Enc(options.Value.StudioUrl)}\">studio</a>.</p>",
                replyTo: null, ct, "visit cap");

        var who = string.IsNullOrWhiteSpace(a.LinkLabel) ? null : a.LinkLabel;
        var fromCountry = a.Country.Length > 0 ? " from " + CountryName(a.Country) : "";
        var viaSource = a.Source.Length > 0 && a.Source != "Direct" ? " via " + a.Source : "";
        var subject = who is not null ? who + " opened your portfolio" : "New visitor" + fromCountry + viaSource;
        var channel = a.Channel.Length > 0 && a.Channel != a.Source ? " (" + a.Channel + ")" : "";
        var cameFrom = a.Source == "Direct"
            ? "Direct (typed the address, a bookmark, or an app that hides the link)"
            : a.Source + channel;
        var rows = new List<(string Label, string Value)>
        {
            ("Came from", cameFrom),
            ("Link", who is not null ? $"Your personal link for {who}" : "Your plain address (no personal link)"),
            ("Location", a.Country.Length == 0 ? "Unknown" : CountryName(a.Country) + (a.NetworkCountry.Length > 0 && a.NetworkCountry != a.Country ? $" (network in {CountryName(a.NetworkCountry)}: a VPN or relay)" : "")),
            ("Device", string.Join(", ", new[] { a.Device, a.Browser }.Where(x => !string.IsNullOrWhiteSpace(x)))),
            ("First page", PageName(a.Path)),
            ("Time", LebanonTime(a.At)),
        };
        rows.RemoveAll(r => string.IsNullOrWhiteSpace(r.Value));

        var text = (who is not null ? $"{who} opened your personal link.\n\n" : "Someone opened your portfolio.\n\n") +
                   string.Join("\n", rows.Select(r => $"{r.Label}: {r.Value}")) +
                   $"\n\nWatch them live and see every page they open: {options.Value.StudioUrl}";
        var html =
            "<div style=\"font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#0b1324\">" +
            $"<h2 style=\"margin:0 0 12px;font-size:20px\">{Enc(subject)}</h2>" +
            "<table style=\"border-collapse:collapse;font-size:14px;width:100%\">" +
            string.Concat(rows.Select(r =>
                $"<tr><td style=\"padding:6px 12px 6px 0;color:#5b6b82;white-space:nowrap;vertical-align:top\">{Enc(r.Label)}</td>" +
                $"<td style=\"padding:6px 0\"><b>{Enc(r.Value)}</b></td></tr>")) +
            "</table>" +
            $"<p style=\"margin:18px 0 0\"><a href=\"{Enc(options.Value.StudioUrl)}\" style=\"display:inline-block;background:#1c6fd1;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px\">Watch live in the studio</a></p>" +
            "<p style=\"margin:14px 0 0;color:#8a97ab;font-size:12px\">One email per visit. The studio shows every page they open and how long they stay.</p></div>";
        return SendAsync(subject, text, html, replyTo: null, ct, "visit");
    }

    private static string CountryName(string code)
    {
        try { return new System.Globalization.RegionInfo(code).EnglishName; }
        catch (ArgumentException) { return code; }
    }

    private static string PageName(string path) => path switch
    {
        "/" => "Home",
        "/about" => "About",
        "/experience" => "Experience",
        "/projects" => "Projects",
        "/services" => "Services",
        "/cv" => "CV",
        _ when path.StartsWith("/projects/") => $"Project: {path["/projects/".Length..]}",
        _ => path,
    };

    private static string LebanonTime(DateTime utc)
    {
        var at = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Beirut", out var tz)
            ? TimeZoneInfo.ConvertTimeFromUtc(at, tz).ToString("ddd d MMM, HH:mm") + " (Lebanon time)"
            : at.ToString("ddd d MMM, HH:mm") + " UTC";
    }

    /// <summary>A short email that proves the setup works, sent from the studio.</summary>
    public Task<bool> SendTestAsync(CancellationToken ct) =>
        IsConfigured
            ? SendAsync(
                "Your portfolio can email you",
                "This is a test from your portfolio studio. New requests will arrive like this.",
                "<p style=\"font-family:system-ui,sans-serif\">This is a test from your portfolio studio. New requests will arrive like this.</p>",
                replyTo: null, ct, "test email")
            : Task.FromResult(false);

    private async Task<bool> SendAsync(string subject, string text, string html, string? replyTo, CancellationToken ct, string what)
    {
        var o = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = o.From,
                to = new[] { o.To.Trim() },
                reply_to = replyTo,
                subject,
                text,
                html,
            }),
        };
        request.Headers.Authorization = new("Bearer", o.ResendApiKey);

        try
        {
            using var response = await http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode) return true;
            logger.LogWarning("Resend returned {Status} for {What}", (int)response.StatusCode, what);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Could not send the email for {What}", what);
        }
        return false;
    }

    private static string Enc(string s) => WebUtility.HtmlEncode(s);
}
