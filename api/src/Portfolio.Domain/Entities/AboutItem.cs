using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

public enum AboutItemType
{
    Education,
    Certification,
    Language,
    Volunteering,
    Client
}

/// <summary>Simple title + detail rows for the About page (and the client list).</summary>
public class AboutItem : IAuditable
{
    public int Id { get; set; }
    public AboutItemType Type { get; set; }
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
