using Microsoft.Extensions.Options;
using Portfolio.Api.Options;

namespace Portfolio.Api.Services;

/// <summary>Triggers a Cloudflare Pages rebuild so the public site picks up new content.</summary>
public class DeployHook(HttpClient http, IOptions<PublishOptions> options)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.DeployHookUrl);

    public async Task<bool> TriggerAsync(CancellationToken ct)
    {
        if (!IsConfigured) return false;
        using var response = await http.PostAsync(options.Value.DeployHookUrl, content: null, ct);
        return response.IsSuccessStatusCode;
    }
}
