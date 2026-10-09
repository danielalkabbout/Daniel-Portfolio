using System.Net;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;
using Portfolio.Domain.Entities;

namespace Portfolio.Api.Services;

/// <summary>
/// Emails you every request sent from the site (services form and "Request the code"), through Resend.
/// The request is always saved to the database first, so a failed email never loses it.
/// Does nothing until Email:ResendApiKey and Email:To are set.
/// </summary>
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
