using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Infrastructure.Content;

/// <summary>Reads and replaces the whole portfolio content in one go.</summary>
public class ContentService(AppDbContext db)
{
    public static readonly string[] Sections =
    [
        "profile", "highlights", "projects", "experience", "clients", "skills", "services",
        "education", "certifications", "languages", "volunteering", "cv", "pages"
    ];

    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    /// <summary>Returns null when the database has no content yet (not seeded).</summary>
    public async Task<SiteContentDto?> GetAsync(CancellationToken ct = default)
    {
        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        if (profile is null) return null;

        var highlights = await db.Highlights.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(ct);
        var projects = await db.Projects.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(ct);
        var experiences = await db.Experiences.AsNoTracking().OrderByDescending(x => x.StartDate).ThenBy(x => x.Id).ToListAsync(ct);
        var skills = await db.SkillCategories.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(ct);
        var services = await db.Services.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(ct);
        var about = await db.AboutItems.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(ct);
        var docs = await db.ContentDocuments.AsNoTracking().ToDictionaryAsync(x => x.Key, ct);

        var stamps = new List<DateTime> { profile.UpdatedAt };
        stamps.AddRange(highlights.Select(x => x.UpdatedAt));
        stamps.AddRange(projects.Select(x => x.UpdatedAt));
        stamps.AddRange(experiences.Select(x => x.UpdatedAt));
        stamps.AddRange(skills.Select(x => x.UpdatedAt));
        stamps.AddRange(services.Select(x => x.UpdatedAt));
        stamps.AddRange(about.Select(x => x.UpdatedAt));
        stamps.AddRange(docs.Values.Select(x => x.UpdatedAt));

        T Doc<T>(string key) where T : new() =>
            docs.TryGetValue(key, out var d) ? JsonSerializer.Deserialize<T>(d.Json, Json) ?? new T() : new T();

        List<TextItemDto> AboutOf(AboutItemType type) => about
            .Where(a => a.Type == type)
            .Select(a => new TextItemDto { Title = a.Title, Detail = a.Detail })
            .ToList();

        return new SiteContentDto
        {
            Version = 1,
            UpdatedAt = DateTime.SpecifyKind(stamps.Max(), DateTimeKind.Utc),
            Profile = new ProfileDto
            {
                Status = profile.Status,
                Hello = profile.Hello,
                Headline = profile.Headline,
                Rotating = profile.RotatingWords,
                Intro = profile.Intro,
                IntroRest = profile.IntroRest,
                Email = profile.Email,
                Whatsapp = profile.WhatsApp,
                Phone = profile.Phone,
                Linkedin = profile.LinkedInUrl,
                Github = profile.GitHubUrl,
                TeamStat = profile.TeamStat,
            },
            Highlights = highlights.Select(h => new HighlightDto { N = h.Number, T = h.Label }).ToList(),
            Projects = projects.Select(p => new ProjectDto
            {
                Id = p.Slug,
                Title = p.Title,
                Short = p.ShortName,
                Kind = p.Kind,
                Tagline = p.Tagline,
                Summary = p.Summary,
                Reel = p.ReelText,
                Features = p.Features,
                Tags = p.Tags,
                Github = p.GitHubUrl,
                Live = p.LiveUrl,
                Demo = p.DemoKey,
                Icon = p.Icon,
                Image = p.ImageUrl,
                Visible = p.IsVisible,
                Home = p.ShowOnHome,
                Cv = !p.HideFromCv,
                CvBullets = p.CvBullets,
            }).ToList(),
            Experience = experiences.Select(e => new ExperienceDto
            {
                Id = e.Slug,
                Title = e.Title,
                Org = e.Organization,
                Start = FormatMonth(e.StartDate),
                End = e.EndDate is { } end ? FormatMonth(end) : null,
                Short = e.ShortLabel,
                Type = e.BadgeType,
                Metrics = e.Metrics.Select(m => new List<string> { m.Value, m.Label }).ToList(),
                Bullets = e.Bullets,
                Tags = e.Tags,
                Milestone = e.IsMilestone,
                Cv = !e.HideFromCv,
            }).ToList(),
            Clients = about.Where(a => a.Type == AboutItemType.Client).Select(a => a.Title).ToList(),
            Skills = skills.Select(s => new SkillCategoryDto { Name = s.Name, Desc = s.Description, Items = s.Items }).ToList(),
            Services = services.Select(s => new ServiceDto
            {
                Id = s.Slug,
                Visual = s.VisualKey,
                Chip = s.ChipLabel,
                Title = s.Title,
                Desc = s.Description,
                Proof = s.Proof,
                Visible = s.IsVisible,
            }).ToList(),
            Education = AboutOf(AboutItemType.Education),
            Certifications = AboutOf(AboutItemType.Certification),
            Languages = AboutOf(AboutItemType.Language),
            Volunteering = AboutOf(AboutItemType.Volunteering),
            Cv = Doc<CvDto>("cv"),
            Pages = Doc<PagesDto>("pages"),
        };
    }

    /// <summary>
    /// Replaces all content in one transaction and returns the names of the sections that changed.
    /// The caller is expected to have validated <paramref name="content"/>.
    /// </summary>
    public async Task<IReadOnlyList<string>> ReplaceAsync(SiteContentDto content, CancellationToken ct = default)
    {
        var before = await GetAsync(ct);
        var changed = ChangedSections(before, content);

        // The database connection retries on failure, so the whole transaction runs inside
        // the execution strategy and starts clean on each attempt.
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(() => WriteAsync(content, ct));
        return changed;
    }

    private async Task WriteAsync(SiteContentDto content, CancellationToken ct)
    {
        db.ChangeTracker.Clear();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        await db.Highlights.ExecuteDeleteAsync(ct);
        await db.Projects.ExecuteDeleteAsync(ct);
        await db.Experiences.ExecuteDeleteAsync(ct);
        await db.SkillCategories.ExecuteDeleteAsync(ct);
        await db.Services.ExecuteDeleteAsync(ct);
        await db.AboutItems.ExecuteDeleteAsync(ct);

        var p = content.Profile;
        var profile = await db.Profiles.FirstOrDefaultAsync(ct);
        if (profile is null)
        {
            profile = new Profile { Id = 1 };
            db.Profiles.Add(profile);
        }
        profile.Status = p.Status ?? "";
        profile.Hello = p.Hello ?? "";
        profile.Headline = p.Headline ?? "";
        profile.RotatingWords = Clean(p.Rotating);
        profile.Intro = p.Intro ?? "";
        profile.IntroRest = p.IntroRest ?? "";
        profile.Email = p.Email ?? "";
        profile.WhatsApp = p.Whatsapp ?? "";
        profile.Phone = p.Phone ?? "";
        profile.LinkedInUrl = p.Linkedin ?? "";
        profile.GitHubUrl = p.Github ?? "";
        profile.TeamStat = p.TeamStat ?? "";

        db.Highlights.AddRange(content.Highlights.Select((h, i) => new Highlight
        {
            Number = h.N ?? "",
            Label = h.T ?? "",
            SortOrder = i,
        }));

        db.Projects.AddRange(content.Projects.Select((x, i) => new Project
        {
            Slug = x.Id,
            Title = x.Title ?? "",
            ShortName = x.Short ?? "",
            Kind = x.Kind ?? "",
            Tagline = x.Tagline ?? "",
            Summary = x.Summary ?? "",
            ReelText = x.Reel ?? "",
            Features = Clean(x.Features),
            Tags = Clean(x.Tags),
            GitHubUrl = x.Github ?? "",
            LiveUrl = x.Live ?? "",
            DemoKey = x.Demo ?? "",
            Icon = string.IsNullOrWhiteSpace(x.Icon) ? "rocket" : x.Icon,
            ImageUrl = x.Image ?? "",
            IsVisible = x.Visible,
            ShowOnHome = x.Home,
            HideFromCv = !x.Cv,
            CvBullets = Clean(x.CvBullets),
            SortOrder = i,
        }));

        db.Experiences.AddRange(content.Experience.Select(x => new Experience
        {
            Slug = x.Id,
            Title = x.Title ?? "",
            ShortLabel = x.Short ?? "",
            Organization = x.Org ?? "",
            StartDate = ParseMonth(x.Start),
            EndDate = string.IsNullOrWhiteSpace(x.End) ? null : ParseMonth(x.End),
            BadgeType = x.Type is null or "Current" ? "" : x.Type,
            Metrics = (x.Metrics ?? [])
                .Where(m => m is { Count: >= 2 } && !string.IsNullOrWhiteSpace(m[0]))
                .Select(m => new ExperienceMetric { Value = m[0], Label = m[1] })
                .ToList(),
            Bullets = Clean(x.Bullets),
            Tags = Clean(x.Tags),
            IsMilestone = x.Milestone,
            HideFromCv = !x.Cv,
        }));

        db.SkillCategories.AddRange(content.Skills.Select((s, i) => new SkillCategory
        {
            Name = s.Name ?? "",
            Description = s.Desc ?? "",
            Items = Clean(s.Items),
            SortOrder = i,
        }));

        db.Services.AddRange(content.Services.Select((s, i) => new Service
        {
            Slug = s.Id,
            VisualKey = string.IsNullOrWhiteSpace(s.Visual) ? "generic" : s.Visual,
            ChipLabel = string.IsNullOrWhiteSpace(s.Chip) ? s.Title ?? "" : s.Chip,
            Title = s.Title ?? "",
            Description = s.Desc ?? "",
            Proof = s.Proof ?? "",
            IsVisible = s.Visible,
            SortOrder = i,
        }));

        AddAbout(AboutItemType.Education, content.Education);
        AddAbout(AboutItemType.Certification, content.Certifications);
        AddAbout(AboutItemType.Language, content.Languages);
        AddAbout(AboutItemType.Volunteering, content.Volunteering);
        AddAbout(AboutItemType.Client, (content.Clients ?? []).Select(c => new TextItemDto { Title = c }).ToList());

        await SetDocAsync("cv", content.Cv ?? new CvDto(), ct);
        await SetDocAsync("pages", content.Pages ?? new PagesDto(), ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>Saves a JSON document, touching it only when it changed so the "last updated" time stays honest.</summary>
    private async Task SetDocAsync<T>(string key, T value, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(value, Json);
        var doc = await db.ContentDocuments.FirstOrDefaultAsync(x => x.Key == key, ct);
        if (doc is null) db.ContentDocuments.Add(new ContentDocument { Key = key, Json = json });
        else if (JsonSerializer.Serialize(JsonSerializer.Deserialize<T>(doc.Json, Json), Json) != json) doc.Json = json;
    }

    private void AddAbout(AboutItemType type, List<TextItemDto>? items)
    {
        if (items is null) return;
        db.AboutItems.AddRange(items
            .Where(t => !string.IsNullOrWhiteSpace(t.Title))
            .Select((t, i) => new AboutItem
            {
                Type = type,
                Title = t.Title.Trim(),
                Detail = t.Detail?.Trim() ?? "",
                SortOrder = i,
            }));
    }

    private static List<string> Clean(List<string>? items) =>
        (items ?? []).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();

    private static IReadOnlyList<string> ChangedSections(SiteContentDto? before, SiteContentDto after)
    {
        if (before is null) return Sections;
        var a = JsonSerializer.SerializeToElement(before, JsonSerializerOptions.Web);
        var b = JsonSerializer.SerializeToElement(after, JsonSerializerOptions.Web);
        return Sections
            .Where(s => a.GetProperty(s).GetRawText() != b.GetProperty(s).GetRawText())
            .ToList();
    }

    /// <summary>"2026-04" becomes 2026-04-01.</summary>
    public static DateOnly ParseMonth(string value)
    {
        var parts = value.Split('-');
        return new DateOnly(int.Parse(parts[0]), int.Parse(parts[1]), 1);
    }

    private static string FormatMonth(DateOnly d) => $"{d.Year:D4}-{d.Month:D2}";
}
