using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>
/// Content kept as one JSON document per key: "cv" (CV settings) and "pages" (page text).
/// They are edited and validated as a whole, so a table per field would add nothing.
/// </summary>
public class ContentDocument : IAuditable
{
    public string Key { get; set; } = "";
    public string Json { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
