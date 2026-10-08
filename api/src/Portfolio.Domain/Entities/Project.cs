using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

public class Project : IAuditable
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string ShortName { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Tagline { get; set; } = "";
    public string Summary { get; set; } = "";
    public string ReelText { get; set; } = "";
    public List<string> Features { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public string GitHubUrl { get; set; } = "";
    public string LiveUrl { get; set; } = "";
    /// <summary>Built-in demo component key (whatsapp, noise, booking, detector, todo, ldap) or empty.</summary>
    public string DemoKey { get; set; } = "";
    public string Icon { get; set; } = "rocket";
    public string ImageUrl { get; set; } = "";
    public bool IsVisible { get; set; } = true;
    public bool ShowOnHome { get; set; } = true;
    /// <summary>Leave this project off the CV.</summary>
    public bool HideFromCv { get; set; }
    /// <summary>Bullets for the CV. Empty means the CV uses the summary.</summary>
    public List<string> CvBullets { get; set; } = [];
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
