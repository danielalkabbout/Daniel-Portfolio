using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;

namespace Portfolio.Api.Services;

/// <summary>Checks Cloudflare Turnstile tokens from the request form. Skipped when no secret is configured.</summary>
public class TurnstileVerifier(HttpClient http, IOptions<TurnstileOptions> options, ILogger<TurnstileVerifier> logger)
{
    public bool IsEnabled => !string.IsNullOrWhiteSpace(options.Value.Secret);

    public async Task<bool> VerifyAsync(string token, string? remoteIp, CancellationToken ct)
    {
        if (!IsEnabled) return true;
        if (string.IsNullOrWhiteSpace(token)) return false;

        var form = new Dictionary<string, string> { ["secret"] = options.Value.Secret, ["response"] = token };
        if (!string.IsNullOrWhiteSpace(remoteIp)) form["remoteip"] = remoteIp;

        try
        {
            using var response = await http.PostAsync(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify", new FormUrlEncodedContent(form), ct);
            var result = await response.Content.ReadFromJsonAsync<SiteVerifyResult>(ct);
            return result?.Success == true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Turnstile verification failed to run");
            return false;
        }
    }

    private sealed record SiteVerifyResult([property: JsonPropertyName("success")] bool Success);
}
