namespace Portfolio.Domain.Entities;

/// <summary>
/// One anonymous page view or CV download. No cookies and no IP address: <see cref="Visitor"/> is a hash
/// that changes every day, so it counts unique visitors per day but can't follow anyone.
/// </summary>
public class Visit
{
    public long Id { get; set; }
    public DateTime At { get; set; }
    /// <summary>"view" or "cv".</summary>
    public string Kind { get; set; } = "view";
    public string Path { get; set; } = "";
    /// <summary>Where the visit came from: LinkedIn, Google, GitHub, a site name, or Direct.</summary>
    public string Source { get; set; } = "";
    /// <summary>Two-letter country code from Cloudflare, or empty.</summary>
    public string Country { get; set; } = "";
    /// <summary>Mobile, Tablet or Desktop.</summary>
    public string Device { get; set; } = "";
    public string Visitor { get; set; } = "";
}
