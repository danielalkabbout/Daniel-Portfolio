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

    // In-app browsers name their app in the user agent. Instagram is checked before Facebook because Meta's
    // apps share link shims, and Messenger before Facebook because it carries the same FBAN marker.
    private static readonly (Regex Pattern, string Name)[] InAppBrowsers =
    [
        (new(@"\bInstagram\b", RegexOptions.IgnoreCase), "Instagram"),
        (new(@"\bBarcelona\b|Threads", RegexOptions.IgnoreCase), "Threads"),
        (new(@"(?<!Micro)Messenger|Orca-Android|FBAN/MessengerForiOS", RegexOptions.IgnoreCase), "Messenger"),
        (new(@"FBAN|FBAV|FB_IAB|FBIOS|FB4A", RegexOptions.None), "Facebook"),
        (new(@"LinkedInApp|com\.linkedin", RegexOptions.IgnoreCase), "LinkedIn"),
        (new(@"musical_ly|BytedanceWebview|TikTok|trill_", RegexOptions.IgnoreCase), "TikTok"),
        (new(@"Snapchat", RegexOptions.IgnoreCase), "Snapchat"),
        (new(@"\bTwitter\b", RegexOptions.IgnoreCase), "X"),
        (new(@"WhatsApp", RegexOptions.IgnoreCase), "WhatsApp"),
        (new(@"Telegram", RegexOptions.IgnoreCase), "Telegram"),
        (new(@"Pinterest", RegexOptions.IgnoreCase), "Pinterest"),
        (new(@"\bSlack\b", RegexOptions.IgnoreCase), "Slack"),
        (new(@"Teams/", RegexOptions.IgnoreCase), "Teams"),
        (new(@"\bGSA/", RegexOptions.None), "Google"),
        (new(@"MicroMessenger", RegexOptions.IgnoreCase), "WeChat"),
        (new(@"\bLine/", RegexOptions.None), "LINE"),
        (new(@"Discord", RegexOptions.IgnoreCase), "Discord"),
        (new(@"Reddit", RegexOptions.IgnoreCase), "Reddit"),
    ];

    // Android apps send "android-app://<package>" as the referrer.
    private static readonly Dictionary<string, string> AndroidApps = new(StringComparer.OrdinalIgnoreCase)
    {
        ["com.instagram.android"] = "Instagram",
        ["com.instagram.barcelona"] = "Threads",
        ["com.facebook.katana"] = "Facebook",
        ["com.facebook.lite"] = "Facebook",
        ["com.facebook.orca"] = "Messenger",
        ["com.linkedin.android"] = "LinkedIn",
        ["com.whatsapp"] = "WhatsApp",
        ["com.whatsapp.w4b"] = "WhatsApp",
        ["org.telegram.messenger"] = "Telegram",
        ["com.google.android.gm"] = "Gmail",
        ["com.google.android.googlequicksearchbox"] = "Google",
        ["com.microsoft.office.outlook"] = "Outlook",
        ["com.microsoft.teams"] = "Teams",
        ["com.slack"] = "Slack",
        ["com.twitter.android"] = "X",
        ["com.zhiliaoapp.musically"] = "TikTok",
        ["com.snapchat.android"] = "Snapchat",
        ["com.reddit.frontpage"] = "Reddit",
        ["com.discord"] = "Discord",
        ["com.github.android"] = "GitHub",
        ["com.openai.chatgpt"] = "ChatGPT",
        ["com.anthropic.claude"] = "Claude",
    };

    // utm_source values people commonly use, normalised to the same names as everything else.
    private static readonly Dictionary<string, string> UtmNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ig"] = "Instagram", ["instagram"] = "Instagram", ["insta"] = "Instagram",
        ["fb"] = "Facebook", ["facebook"] = "Facebook",
        ["li"] = "LinkedIn", ["linkedin"] = "LinkedIn",
        ["wa"] = "WhatsApp", ["whatsapp"] = "WhatsApp",
        ["x"] = "X", ["twitter"] = "X",
        ["tg"] = "Telegram", ["telegram"] = "Telegram",
        ["tiktok"] = "TikTok", ["tt"] = "TikTok",
        ["threads"] = "Threads", ["messenger"] = "Messenger",
        ["github"] = "GitHub", ["gh"] = "GitHub",
        ["email"] = "Email", ["mail"] = "Email", ["newsletter"] = "Email",
        ["cv"] = "CV link", ["resume"] = "CV link", ["qr"] = "QR code",
    };

    /// <summary>
    /// A readable name for where a visitor came from, from the strongest signal available: an utm_source in
    /// the landing address, the app whose in-app browser opened the site, then the referring site.
    /// </summary>
    public static string Source(string? referrer, string? userAgent = null, string? utm = null)
    {
        var u = (utm ?? "").Trim();
        if (u.Length is > 0 and <= 40 && UtmRegex().IsMatch(u))
            return UtmNames.TryGetValue(u, out var named) ? named : char.ToUpperInvariant(u[0]) + u[1..].ToLowerInvariant();

        if (!string.IsNullOrEmpty(userAgent))
            foreach (var (pattern, name) in InAppBrowsers)
                if (pattern.IsMatch(userAgent)) return name;

        if (string.IsNullOrWhiteSpace(referrer) || !Uri.TryCreate(referrer, UriKind.Absolute, out var uri)) return "Direct";
        if (uri.Scheme == "android-app")
            return AndroidApps.TryGetValue(uri.Host, out var app) ? app : "Android app";
        if (uri.Scheme is not ("http" or "https")) return "Direct";

        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        bool Is(string domain) => host == domain || host.EndsWith("." + domain);

        return host switch
        {
            _ when Is("lnkd.in") || Is("linkedin.com") => "LinkedIn",
            _ when Is("instagram.com") || Is("ig.me") => "Instagram",
            _ when Is("threads.net") || Is("threads.com") => "Threads",
            _ when Is("messenger.com") || Is("m.me") => "Messenger",
            _ when Is("facebook.com") || Is("fb.com") || Is("fb.me") || Is("fb.watch") => "Facebook",
            _ when Is("whatsapp.com") || Is("wa.me") || Is("l.wl.co") => "WhatsApp",
            _ when Is("t.me") || Is("telegram.org") || Is("telegram.me") => "Telegram",
            _ when Is("t.co") || Is("x.com") || Is("twitter.com") => "X",
            _ when Is("tiktok.com") => "TikTok",
            _ when Is("snapchat.com") => "Snapchat",
            _ when Is("youtube.com") || Is("youtu.be") => "YouTube",
            _ when Is("reddit.com") => "Reddit",
            _ when Is("pinterest.com") || Is("pin.it") => "Pinterest",
            _ when Is("discord.com") || Is("discord.gg") => "Discord",
            _ when Is("slack.com") => "Slack",
            _ when Is("teams.microsoft.com") || Is("teams.live.com") => "Teams",
            _ when Is("mail.google.com") => "Gmail",
            _ when Is("outlook.live.com") || Is("outlook.office.com") || Is("outlook.office365.com") => "Outlook",
            _ when Is("mail.yahoo.com") => "Yahoo Mail",
            _ when Is("gemini.google.com") || Is("bard.google.com") => "Gemini",
            _ when Is("chatgpt.com") || Is("chat.openai.com") || Is("openai.com") => "ChatGPT",
            _ when Is("claude.ai") => "Claude",
            _ when Is("perplexity.ai") => "Perplexity",
            _ when Is("copilot.microsoft.com") => "Copilot",
            _ when host.StartsWith("google.") || host.Contains(".google.") || Is("google.com") => "Google",
            _ when Is("bing.com") => "Bing",
            _ when Is("duckduckgo.com") => "DuckDuckGo",
            _ when Is("search.yahoo.com") || Is("yahoo.com") => "Yahoo",
            _ when Is("yandex.ru") || Is("yandex.com") => "Yandex",
            _ when Is("ecosia.org") => "Ecosia",
            _ when Is("search.brave.com") => "Brave Search",
            _ when Is("github.com") || Is("github.io") => "GitHub",
            _ when Is("gitlab.com") => "GitLab",
            _ when Is("stackoverflow.com") => "Stack Overflow",
            _ when Is("medium.com") => "Medium",
            _ when Is("dev.to") => "DEV",
            _ when Is("indeed.com") || Is("wuzzuf.net") || Is("bayt.com") || Is("glassdoor.com") || Is("upwork.com") => "Job sites",
            _ => host.Length > 60 ? host[..60] : host,
        };
    }

    private static readonly Dictionary<string, string> Channels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Direct"] = "Direct",
        ["LinkedIn"] = "Social", ["Instagram"] = "Social", ["Facebook"] = "Social", ["Threads"] = "Social",
        ["X"] = "Social", ["TikTok"] = "Social", ["Snapchat"] = "Social", ["YouTube"] = "Social",
        ["Reddit"] = "Social", ["Pinterest"] = "Social",
        ["WhatsApp"] = "Messaging", ["Messenger"] = "Messaging", ["Telegram"] = "Messaging", ["Slack"] = "Messaging",
        ["Teams"] = "Messaging", ["Discord"] = "Messaging", ["WeChat"] = "Messaging", ["LINE"] = "Messaging",
        ["Gmail"] = "Email", ["Outlook"] = "Email", ["Yahoo Mail"] = "Email", ["Email"] = "Email",
        ["Google"] = "Search", ["Bing"] = "Search", ["DuckDuckGo"] = "Search", ["Yahoo"] = "Search",
        ["Yandex"] = "Search", ["Ecosia"] = "Search", ["Brave Search"] = "Search",
        ["ChatGPT"] = "AI", ["Claude"] = "AI", ["Gemini"] = "AI", ["Perplexity"] = "AI", ["Copilot"] = "AI",
    };

    /// <summary>The kind of place a source is: Social, Messaging, Email, Search, AI, Direct or Website.</summary>
    public static string Channel(string source) =>
        Channels.TryGetValue(source, out var c) ? c : source.Length == 0 ? "" : "Website";

    [GeneratedRegex(@"^[A-Za-z0-9 ._-]+$")]
    private static partial Regex UtmRegex();

    /// <summary>
    /// The visitor's country: from the browser's time zone when it names one (it follows the device even behind
    /// a VPN or Private Relay), otherwise from Cloudflare's IP lookup.
    /// </summary>
    public static string Country(string? ipCountry, string? timeZone) =>
        TimeZoneCountries.Lookup(timeZone) ?? Country(ipCountry);

    /// <summary>Two letters from Cloudflare, or empty. "XX" and "T1" (Tor) mean unknown.</summary>
    public static string Country(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        return c.Length == 2 && char.IsAsciiLetterUpper(c[0]) && char.IsAsciiLetterUpper(c[1]) && c != "XX" ? c : "";
    }

    /// <summary>A per-tab id from the browser (random, not stored on the device beyond the tab), or empty.</summary>
    public static string Session(string? id) =>
        id is { Length: >= 8 and <= 24 } && id.All(char.IsAsciiLetterOrDigit) ? id.ToLowerInvariant() : "";

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
