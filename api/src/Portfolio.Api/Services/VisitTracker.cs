using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Portfolio.Api.Services;

/// <summary>
/// Turns a page view into anonymous facts: where it came from, the country, the kind of device, and a
/// visitor hash made from the IP and browser with a secret that changes every day and is never stored.
/// The IP address itself is never saved.
/// </summary>
public partial class VisitTracker
{
    private readonly Lock gate = new();
    private DateOnly saltDay;
    private byte[] salt = [];

    [GeneratedRegex(@"bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|curl|wget|python|httpclient|monitor|uptime", RegexOptions.IgnoreCase)]
    private static partial Regex BotRegex();

    [GeneratedRegex(@"iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))", RegexOptions.IgnoreCase)]
    private static partial Regex TabletRegex();

    [GeneratedRegex(@"Mobi|iPhone|iPod|Android.*Mobile|Windows Phone", RegexOptions.IgnoreCase)]
    private static partial Regex MobileRegex();

    [GeneratedRegex(@"^/[a-z0-9/_-]{0,120}$")]
    private static partial Regex PathRegex();

    public static bool IsBot(string? userAgent) => string.IsNullOrWhiteSpace(userAgent) || BotRegex().IsMatch(userAgent);

    public static string Device(string? userAgent) =>
        userAgent is null ? "" : TabletRegex().IsMatch(userAgent) ? "Tablet" : MobileRegex().IsMatch(userAgent) ? "Mobile" : "Desktop";

    /// <summary>A clean page path, or null for anything that shouldn't be counted (the studio, odd input).</summary>
    public static string? CleanPath(string? path)
    {
        var p = (path ?? "").Split('?', '#')[0].ToLowerInvariant().TrimEnd('/');
        if (p.Length == 0) p = "/";
        if (!PathRegex().IsMatch(p) || p.StartsWith("/admin") || p.StartsWith("/api")) return null;
        return p;
    }

    /// <summary>A readable name for where a visitor came from.</summary>
    public static string Source(string? referrer, string? siteHost)
    {
        if (string.IsNullOrWhiteSpace(referrer) || !Uri.TryCreate(referrer, UriKind.Absolute, out var uri)) return "Direct";
        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        if (!string.IsNullOrEmpty(siteHost) && host == siteHost.ToLowerInvariant()) return "Direct";
        return host switch
        {
            _ when host == "lnkd.in" || host.EndsWith("linkedin.com") || host.EndsWith("linkedin.android") => "LinkedIn",
            _ when host.Contains("google.") => "Google",
            _ when host == "github.com" || host.EndsWith(".github.com") || host.EndsWith("github.io") => "GitHub",
            _ when host.Contains("bing.com") => "Bing",
            _ when host.Contains("duckduckgo.com") => "DuckDuckGo",
            _ when host.EndsWith("facebook.com") || host == "l.facebook.com" || host == "fb.me" => "Facebook",
            _ when host.EndsWith("instagram.com") => "Instagram",
            _ when host == "t.co" || host == "x.com" || host.EndsWith("twitter.com") => "X",
            _ when host.Contains("whatsapp") => "WhatsApp",
            _ when host.EndsWith("chatgpt.com") || host.EndsWith("openai.com") => "ChatGPT",
            _ when host.EndsWith("claude.ai") => "Claude",
            _ => host.Length > 60 ? host[..60] : host,
        };
    }

    /// <summary>Two letters from Cloudflare, or empty. "XX" and "T1" (Tor) mean unknown.</summary>
    public static string Country(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        return c.Length == 2 && char.IsAsciiLetterUpper(c[0]) && char.IsAsciiLetterUpper(c[1]) && c != "XX" ? c : "";
    }

    /// <summary>Same visitor on the same day gives the same value; a new day gives a new one.</summary>
    public string VisitorHash(string? ip, string? userAgent)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        byte[] key;
        lock (gate)
        {
            if (saltDay != today)
            {
                saltDay = today;
                salt = RandomNumberGenerator.GetBytes(32);
            }
            key = salt;
        }
        var hash = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{ip}|{userAgent}"));
        return Convert.ToHexStringLower(hash)[..16];
    }
}
