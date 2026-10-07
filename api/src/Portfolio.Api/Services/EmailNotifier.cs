using Microsoft.Extensions.Options;
using Portfolio.Api.Options;
using Portfolio.Domain.Entities;

namespace Portfolio.Api.Services;

/// <summary>Emails you each new service request through Resend. Does nothing if not configured.</summary>
public class EmailNotifier(HttpClient http, IOptions<EmailOptions> options, ILogger<EmailNotifier> logger)
{
    public async Task NotifyNewRequestAsync(ServiceRequest r, CancellationToken ct)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.ResendApiKey) || string.IsNullOrWhiteSpace(o.To)) return;

        var text =
            $"New service request from {r.Name} <{r.Email}>\n" +
            (string.IsNullOrWhiteSpace(r.Company) ? "" : $"Company: {r.Company}\n") +
            $"Services: {string.Join(", ", r.Services)}\n" +
            $"Timeline: {r.Timeline}\n\n{r.Message}";

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = o.From,
                to = new[] { o.To },
                reply_to = r.Email,
                subject = $"Service request: {string.Join(", ", r.Services)}",
                text,
            }),
        };
        request.Headers.Authorization = new("Bearer", o.ResendApiKey);

        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                logger.LogWarning("Resend returned {Status} for request {Id}", (int)response.StatusCode, r.Id);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Could not send the email for request {Id}", r.Id);
        }
    }
}
