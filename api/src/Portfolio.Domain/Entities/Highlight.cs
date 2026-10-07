using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>The big numbers on the home page, e.g. "12" + "SPFx web parts".</summary>
public class Highlight : IAuditable
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string Label { get; set; } = "";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
