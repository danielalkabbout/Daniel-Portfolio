namespace Portfolio.Domain.Entities;

/// <summary>
/// One anonymous page view or CV download. No cookies and no IP address: <see cref="Visitor"/> is a hash
/// that changes every day, so it counts unique visitors per day but can't follow anyone.
/// </summary>
public class Visit
{
    public long Id { get; set; }
    public DateTime At { get; set; }
    /// <summary>"view", "cv", or "time" (seconds spent on <see cref="Path"/>, sent when the visitor moves on or leaves).</summary>
    public string Kind { get; set; } = "view";
    public string Path { get; set; } = "";
    /// <summary>Where the visit came from: LinkedIn, Instagram, WhatsApp, Google, a site name, or Direct.</summary>
    public string Source { get; set; } = "";
    /// <summary>Two-letter country code, from the browser's time zone or else Cloudflare, or empty.</summary>
    public string Country { get; set; } = "";
    /// <summary>Mobile, Tablet or Desktop.</summary>
    public string Device { get; set; } = "";
    public string Visitor { get; set; } = "";
    /// <summary>Code of the personal link the visit started from, or empty.</summary>
    public string Ref { get; set; } = "";
    /// <summary>Random id for one browser tab, so one visit's pages stay together. Empty on older rows.</summary>
    public string Session { get; set; } = "";
    /// <summary>For "time" rows: active seconds on the page (tab visible and not idle).</summary>
    public int Seconds { get; set; }
    /// <summary>The device's IANA time zone, which decides <see cref="Country"/> when it names one.</summary>
    public string TimeZone { get; set; } = "";
    /// <summary>The country of the visitor's network (Cloudflare's IP lookup), kept to show VPNs and relays.</summary>
    public string NetworkCountry { get; set; } = "";
}
