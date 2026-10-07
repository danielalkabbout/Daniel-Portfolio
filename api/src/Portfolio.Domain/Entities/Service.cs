using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

public class Service : IAuditable
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    /// <summary>Animation key on the Services page (ai, wa, web, mob, sp, api, tr, generic).</summary>
    public string VisualKey { get; set; } = "generic";
    public string ChipLabel { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Proof { get; set; } = "";
    public bool IsVisible { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
