using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Portfolio.Api.Contracts;
using Portfolio.Api.Options;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Api.Services;

/// <summary>
/// Echo, the assistant on the home page. Answers only from the portfolio content, using Gemini.
/// When Gemini is not configured or fails, the endpoint returns 503 and the frontend falls back
/// to its built-in rule-based answers.
/// </summary>
public class EchoAssistant(
    HttpClient http,
    IOptions<GeminiOptions> options,
    IMemoryCache cache,
    ContentService content,
    ILogger<EchoAssistant> logger)
{
    public const string FactsCacheKey = "echo:facts";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiKey);

    public async Task<string?> AskAsync(EchoRequest request, CancellationToken ct)
    {
        var facts = await cache.GetOrCreateAsync(FactsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            var site = await content.GetAsync(ct);
            return site is null ? "" : BuildFacts(site);
        });
        if (string.IsNullOrWhiteSpace(facts)) return null;

        var contents = request.History
            .TakeLast(6)
            .Select(t => new GeminiContent(t.Role == "assistant" ? "model" : "user", [new GeminiPart(t.Content)]))
            .Append(new GeminiContent("user", [new GeminiPart(request.Question)]))
            .ToList();

        var body = new GeminiRequest(
            new GeminiContent(null, [new GeminiPart(SystemPrompt(facts))]),
            contents,
            new GeminiConfig(0.3, 350));

        var o = options.Value;
        using var message = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{o.Model}:generateContent")
        {
            Content = JsonContent.Create(body),
        };
        message.Headers.Add("x-goog-api-key", o.ApiKey);

        try
        {
            using var response = await http.SendAsync(message, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Gemini returned {Status}", (int)response.StatusCode);
                return null;
            }
            var result = await response.Content.ReadFromJsonAsync<GeminiResponse>(ct);
            var text = string.Concat(result?.Candidates?.FirstOrDefault()?.Content?.Parts?.Select(p => p.Text) ?? []);
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Gemini call failed");
            return null;
        }
    }

    private static string SystemPrompt(string facts) =>
        "You are Echo, the assistant on Daniel Al Kabbout's portfolio website, talking to a visitor " +
        "(often a recruiter or a potential client). Answer ONLY from the facts below. Rules: refer to Daniel " +
        "in the third person; 1 to 3 short sentences, plain text, no markdown, no lists; never invent numbers, " +
        "dates, clients, prices, availability or skills; if the answer is not in the facts, say it is not on " +
        "his CV and suggest emailing him; for hiring or quotes, point to the Services page request form; " +
        "politely decline personal questions; reply in the visitor's language.\n\nFACTS:\n" + facts;

    /// <summary>Turns the portfolio content into a compact fact sheet for the model.</summary>
    public static string BuildFacts(SiteContentDto s)
    {
        var p = s.Profile;
        var sb = new StringBuilder();
        sb.AppendLine($"Name: Daniel Al Kabbout. {p.Intro} {p.IntroRest} Status: {p.Status}.");
        sb.AppendLine($"Contact: email {p.Email}, WhatsApp +{p.Whatsapp}, {p.Linkedin}, {p.Github}.");
        sb.AppendLine("Highlights: " + string.Join("; ", s.Highlights.Select(h => $"{h.N} {h.T}")));
        sb.AppendLine("Experience:");
        foreach (var e in s.Experience)
        {
            if (e.Milestone) { sb.AppendLine($"- Milestone: {e.Title}, {e.Org}, {e.Start}"); continue; }
            sb.AppendLine($"- {e.Title}, {e.Org}, {e.Start} to {e.End ?? "present"}: {string.Join(" ", e.Bullets)}");
        }
        sb.AppendLine("Projects:");
        foreach (var x in s.Projects.Where(x => x.Visible))
            sb.AppendLine($"- {x.Title} ({string.Join(", ", x.Tags)}): {x.Summary} {string.Join(" ", x.Features)}");
        sb.AppendLine("Skills: " + string.Join(" | ", s.Skills.Select(c => $"{c.Name}: {string.Join(", ", c.Items)}")));
        sb.AppendLine("Services offered: " + string.Join("; ", s.Services.Where(x => x.Visible).Select(x => $"{x.Title}: {x.Desc}")));
        sb.AppendLine("Education: " + string.Join("; ", s.Education.Select(x => $"{x.Title}, {x.Detail}")));
        sb.AppendLine("Certifications: " + string.Join("; ", s.Certifications.Select(x => $"{x.Title}, {x.Detail}")));
        sb.AppendLine("Languages: " + string.Join("; ", s.Languages.Select(x => $"{x.Title}: {x.Detail}")));
        sb.AppendLine("Volunteering: " + string.Join("; ", s.Volunteering.Select(x => $"{x.Title}: {x.Detail}")));
        sb.AppendLine("Clients: " + string.Join(", ", s.Clients));
        return sb.ToString();
    }

    private sealed record GeminiRequest(
        [property: JsonPropertyName("systemInstruction")] GeminiContent SystemInstruction,
        [property: JsonPropertyName("contents")] List<GeminiContent> Contents,
        [property: JsonPropertyName("generationConfig")] GeminiConfig GenerationConfig);

    private sealed record GeminiContent(
        [property: JsonPropertyName("role"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Role,
        [property: JsonPropertyName("parts")] List<GeminiPart> Parts);

    private sealed record GeminiPart([property: JsonPropertyName("text")] string Text);

    private sealed record GeminiConfig(
        [property: JsonPropertyName("temperature")] double Temperature,
        [property: JsonPropertyName("maxOutputTokens")] int MaxOutputTokens);

    private sealed record GeminiResponse([property: JsonPropertyName("candidates")] List<GeminiCandidate>? Candidates);

    private sealed record GeminiCandidate([property: JsonPropertyName("content")] GeminiContent? Content);
}
