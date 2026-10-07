using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Portfolio.Domain.Entities;

namespace Portfolio.Infrastructure.Persistence;

/// <summary>Imports the content JSON exported from the old Studio (same shape as web/src/content/fallback.json).</summary>
public class ContentSeeder(AppDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<string> SeedAsync(string path, CancellationToken ct = default)
    {
        if (await db.Profiles.AnyAsync(ct))
            return "The database already has content, so seeding was skipped.";
        if (!File.Exists(path))
            return $"Seed file not found: {path}";

        var json = await File.ReadAllTextAsync(path, ct);
        var seed = JsonSerializer.Deserialize<SeedContent>(json, JsonOptions)
                   ?? throw new InvalidOperationException("The seed file is empty or invalid.");

        var p = seed.Profile;
        db.Profiles.Add(new Profile
        {
            Id = 1,
            Status = p.Status,
            Hello = p.Hello,
            Headline = p.Headline,
            RotatingWords = p.Rotating ?? [],
            Intro = p.Intro,
            IntroRest = p.IntroRest,
            Email = p.Email,
            WhatsApp = p.Whatsapp,
            Phone = p.Phone,
            LinkedInUrl = p.Linkedin,
            GitHubUrl = p.Github,
            TeamStat = p.TeamStat ?? "",
        });

        db.Highlights.AddRange(seed.Highlights.Select((h, i) => new Highlight { Number = h.N, Label = h.T, SortOrder = i }));

        db.Projects.AddRange(seed.Projects.Select((x, i) => new Project
        {
            Slug = x.Id,
            Title = x.Title,
            ShortName = x.Short ?? "",
            Kind = x.Kind ?? "",
            Tagline = x.Tagline ?? "",
            Summary = x.Summary,
            ReelText = x.Reel ?? "",
            Features = x.Features ?? [],
            Tags = x.Tags ?? [],
            GitHubUrl = x.Github ?? "",
            LiveUrl = x.Live ?? "",
            DemoKey = x.Demo ?? "",
            Icon = string.IsNullOrWhiteSpace(x.Icon) ? "rocket" : x.Icon,
            ImageUrl = x.Image ?? "",
            IsVisible = x.Visible ?? true,
            ShowOnHome = x.Home ?? true,
            SortOrder = i,
        }));

        db.Experiences.AddRange(seed.Experience.Select(x => new Experience
        {
            Slug = x.Id,
            Title = x.Title,
            ShortLabel = x.Short ?? "",
            Organization = x.Org,
            StartDate = ParseMonth(x.Start),
            EndDate = string.IsNullOrWhiteSpace(x.End) ? null : ParseMonth(x.End),
            BadgeType = x.Type is null or "Current" ? "" : x.Type,
            Metrics = (x.Metrics ?? [])
                .Where(m => m.Count >= 2)
                .Select(m => new ExperienceMetric { Value = m[0], Label = m[1] })
                .ToList(),
            Bullets = x.Bullets ?? [],
            Tags = x.Tags ?? [],
            IsMilestone = x.Milestone ?? false,
        }));

        db.SkillCategories.AddRange(seed.Skills.Select((s, i) => new SkillCategory
        {
            Name = s.Name,
            Description = s.Desc ?? "",
            Items = s.Items,
            SortOrder = i,
        }));

        db.Services.AddRange(seed.Services.Select((s, i) => new Service
        {
            Slug = s.Id,
            VisualKey = s.Visual ?? "generic",
            ChipLabel = s.Chip,
            Title = s.Title,
            Description = s.Desc,
            Proof = s.Proof ?? "",
            IsVisible = s.Visible ?? true,
            SortOrder = i,
        }));

        AddAbout(AboutItemType.Education, seed.Education);
        AddAbout(AboutItemType.Certification, seed.Certifications);
        AddAbout(AboutItemType.Language, seed.Languages);
        AddAbout(AboutItemType.Volunteering, seed.Volunteering);
        AddAbout(AboutItemType.Client, seed.Clients?.Select(c => new SeedText(c, "")).ToList());

        await db.SaveChangesAsync(ct);

        return $"Seeded {seed.Projects.Count} projects, {seed.Experience.Count} experience entries, " +
               $"{seed.Skills.Count} skill categories and {seed.Services.Count} services.";
    }

    private void AddAbout(AboutItemType type, List<SeedText>? items)
    {
        if (items is null) return;
        db.AboutItems.AddRange(items.Select((t, i) => new AboutItem
        {
            Type = type,
            Title = t.Title,
            Detail = t.Detail ?? "",
            SortOrder = i,
        }));
    }

    /// <summary>"2026-04" becomes 2026-04-01.</summary>
    private static DateOnly ParseMonth(string value)
    {
        var parts = value.Split('-');
        return new DateOnly(int.Parse(parts[0]), int.Parse(parts[1]), 1);
    }

    // Shapes of the exported JSON
    private sealed record SeedContent(
        SeedProfile Profile,
        List<SeedHighlight> Highlights,
        List<SeedProject> Projects,
        List<SeedExperience> Experience,
        List<string>? Clients,
        List<SeedSkill> Skills,
        List<SeedService> Services,
        List<SeedText>? Education,
        List<SeedText>? Certifications,
        List<SeedText>? Languages,
        List<SeedText>? Volunteering);

    private sealed record SeedProfile(
        string Status, string Hello, string Headline, List<string>? Rotating, string Intro, string IntroRest,
        string Email, string Whatsapp, string Phone, string Linkedin, string Github, string? TeamStat);

    private sealed record SeedHighlight(string N, string T);

    private sealed record SeedProject(
        string Id, string Title, string? Short, string? Kind, string? Tagline, string Summary, string? Reel,
        List<string>? Features, List<string>? Tags, string? Github, string? Live, string? Demo, string? Icon,
        string? Image, bool? Visible, bool? Home);

    private sealed record SeedExperience(
        string Id, string Title, string Org, string Start, string? End, string? Short, string? Type,
        List<List<string>>? Metrics, List<string>? Bullets, List<string>? Tags, bool? Milestone);

    private sealed record SeedSkill(string Name, string? Desc, List<string> Items);

    private sealed record SeedService(
        string Id, string? Visual, string Chip, string Title, string Desc, string? Proof, bool? Visible);

    private sealed record SeedText(string Title, string? Detail);
}
