namespace Portfolio.Infrastructure.Content;

/// <summary>
/// The whole portfolio content as one document. Same JSON shape as web/src/content/fallback.json,
/// so the frontend, the seed file and GET /api/content all speak the same format.
/// </summary>
public sealed class SiteContentDto
{
    public int Version { get; set; } = 1;
    public DateTime? UpdatedAt { get; set; }
    public ProfileDto Profile { get; set; } = new();
    public List<HighlightDto> Highlights { get; set; } = [];
    public List<ProjectDto> Projects { get; set; } = [];
    public List<ExperienceDto> Experience { get; set; } = [];
    public List<string> Clients { get; set; } = [];
    public List<SkillCategoryDto> Skills { get; set; } = [];
    public List<ServiceDto> Services { get; set; } = [];
    public List<TextItemDto> Education { get; set; } = [];
    public List<TextItemDto> Certifications { get; set; } = [];
    public List<TextItemDto> Languages { get; set; } = [];
    public List<TextItemDto> Volunteering { get; set; } = [];
    /// <summary>CV settings. Empty values mean "use the site's built-in default".</summary>
    public CvDto Cv { get; set; } = new();
    /// <summary>Editable page text. Empty values mean "use the site's built-in default".</summary>
    public PagesDto Pages { get; set; } = new();
}

public sealed class CvDto
{
    /// <summary>Parts of the line under the name, shown joined by " | ".</summary>
    public List<string> Headline { get; set; } = [];
    public string Summary { get; set; } = "";
    public string Location { get; set; } = "";
    public string Availability { get; set; } = "";
    public bool ShowWebsite { get; set; } = true;
    /// <summary>How projects are described: "summary", "features" or "both". A project's own CV bullets win.</summary>
    public string ProjectStyle { get; set; } = "summary";
    /// <summary>Order, titles and visibility of the CV sections.</summary>
    public List<CvSectionDto> Sections { get; set; } = [];
}

public sealed class CvSectionDto
{
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public bool Visible { get; set; } = true;
}

public sealed class PagesDto
{
    public PageTextDto Home { get; set; } = new();
    public PageTextDto About { get; set; } = new();
    public PageTextDto Experience { get; set; } = new();
    public PageTextDto Projects { get; set; } = new();
    public PageTextDto Services { get; set; } = new();
    public PageTextDto Cv { get; set; } = new();
    public PageTextDto Footer { get; set; } = new();
}

/// <summary>The text blocks a page can have. Each page uses the ones it needs.</summary>
public sealed class PageTextDto
{
    public string Kicker { get; set; } = "";
    public string Title { get; set; } = "";
    public string Accent { get; set; } = "";
    public string Intro { get; set; } = "";
    public string Lead { get; set; } = "";
    public List<string> Paragraphs { get; set; } = [];
    public List<string> Items { get; set; } = [];
    public List<TextItemDto> Steps { get; set; } = [];
}

public sealed class ProfileDto
{
    public string Status { get; set; } = "";
    public string Hello { get; set; } = "";
    public string Headline { get; set; } = "";
    public List<string> Rotating { get; set; } = [];
    public string Intro { get; set; } = "";
    public string IntroRest { get; set; } = "";
    public string Email { get; set; } = "";
    public string Whatsapp { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Linkedin { get; set; } = "";
    public string Github { get; set; } = "";
    public string TeamStat { get; set; } = "";
}

public sealed class HighlightDto
{
    public string N { get; set; } = "";
    public string T { get; set; } = "";
}

public sealed class ProjectDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Short { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Tagline { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Reel { get; set; } = "";
    public List<string> Features { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public string Github { get; set; } = "";
    public string Live { get; set; } = "";
    public string Demo { get; set; } = "";
    public string Icon { get; set; } = "rocket";
    public string Image { get; set; } = "";
    public bool Visible { get; set; } = true;
    public bool Home { get; set; } = true;
    /// <summary>Shown on the CV.</summary>
    public bool Cv { get; set; } = true;
    /// <summary>CV bullets for this project. Empty means the CV's project style decides.</summary>
    public List<string> CvBullets { get; set; } = [];
}

public sealed class ExperienceDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Org { get; set; } = "";
    /// <summary>"YYYY-MM"</summary>
    public string Start { get; set; } = "";
    /// <summary>"YYYY-MM", or null for a current role.</summary>
    public string? End { get; set; }
    public string Short { get; set; } = "";
    public string Type { get; set; } = "";
    /// <summary>Pairs of [value, label], e.g. ["12", "SPFx web parts"].</summary>
    public List<List<string>> Metrics { get; set; } = [];
    public List<string> Bullets { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public bool Milestone { get; set; }
    /// <summary>Shown on the CV.</summary>
    public bool Cv { get; set; } = true;
}

public sealed class SkillCategoryDto
{
    public string Name { get; set; } = "";
    public string Desc { get; set; } = "";
    public List<string> Items { get; set; } = [];
}

public sealed class ServiceDto
{
    public string Id { get; set; } = "";
    public string Visual { get; set; } = "generic";
    public string Chip { get; set; } = "";
    public string Title { get; set; } = "";
    public string Desc { get; set; } = "";
    public string Proof { get; set; } = "";
    public bool Visible { get; set; } = true;
}

public sealed class TextItemDto
{
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
}
