using System.Text.RegularExpressions;
using FluentValidation;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Api.Validation;

/// <summary>Validates content before it replaces what is in the database. Limits match the database columns.</summary>
public partial class SiteContentValidator : AbstractValidator<SiteContentDto>
{
    public static readonly string[] DemoKeys = ["", "whatsapp", "noise", "booking", "detector", "todo", "ldap"];
    public static readonly string[] VisualKeys = ["ai", "wa", "web", "mob", "sp", "api", "tr", "generic"];

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugRegex();

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthRegex();

    public SiteContentValidator()
    {
        RuleFor(x => x.Profile).NotNull().SetValidator(new ProfileValidator());

        RuleFor(x => x.Highlights).NotNull().Must(l => l.Count <= 8).WithMessage("Use at most 8 highlights.");
        RuleForEach(x => x.Highlights).ChildRules(h =>
        {
            h.RuleFor(x => x.N).NotEmpty().MaximumLength(12);
            h.RuleFor(x => x.T).NotEmpty().MaximumLength(160);
        });

        RuleFor(x => x.Projects).NotNull().Must(l => l.Count <= 50).WithMessage("Use at most 50 projects.")
            .Must(UniqueIds).WithMessage("Two projects share the same id.");
        RuleForEach(x => x.Projects).ChildRules(p =>
        {
            p.RuleFor(x => x.Id).NotEmpty().MaximumLength(80).Matches(SlugRegex())
                .WithMessage("Project id must use lowercase letters, numbers and dashes, like 'whatsapp-bot'.");
            p.RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
            p.RuleFor(x => x.Short).MaximumLength(60);
            p.RuleFor(x => x.Kind).MaximumLength(80);
            p.RuleFor(x => x.Tagline).MaximumLength(60);
            p.RuleFor(x => x.Summary).NotEmpty().MaximumLength(600);
            p.RuleFor(x => x.Reel).MaximumLength(300);
            p.RuleFor(x => x.Features).Must(l => l.Count <= 12).WithMessage("Use at most 12 features.");
            p.RuleForEach(x => x.Features).MaximumLength(300);
            p.RuleFor(x => x.Tags).Must(l => l.Count <= 20).WithMessage("Use at most 20 tags.");
            p.RuleForEach(x => x.Tags).MaximumLength(40);
            p.RuleFor(x => x.Github).Must(BeEmptyOrHttpsUrl).WithMessage("Enter a full link starting with https://");
            p.RuleFor(x => x.Live).Must(BeEmptyOrHttpsUrl).WithMessage("Enter a full link starting with https://");
            p.RuleFor(x => x.Demo).Must(d => DemoKeys.Contains(d ?? "")).WithMessage("Unknown demo.");
            p.RuleFor(x => x.Icon).MaximumLength(30);
            p.RuleFor(x => x.CvBullets).Must(l => l.Count <= 6).WithMessage("Use at most 6 CV bullets.");
            p.RuleForEach(x => x.CvBullets).MaximumLength(400);
            p.RuleFor(x => x.Image).Must(BeEmptyUrlOrDataImage)
                .WithMessage("The screenshot must be an https link or an uploaded image under 1.5 MB.");
        });

        RuleFor(x => x.Experience).NotNull().Must(l => l.Count <= 40).WithMessage("Use at most 40 experience entries.")
            .Must(UniqueIds).WithMessage("Two experience entries share the same id.");
        RuleForEach(x => x.Experience).ChildRules(e =>
        {
            e.RuleFor(x => x.Id).NotEmpty().MaximumLength(80).Matches(SlugRegex());
            e.RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
            e.RuleFor(x => x.Org).NotEmpty().MaximumLength(120);
            e.RuleFor(x => x.Start).NotEmpty().Matches(MonthRegex()).WithMessage("Start must look like 2026-04.");
            e.RuleFor(x => x.End).Matches(MonthRegex()).When(x => !string.IsNullOrEmpty(x.End))
                .WithMessage("End must look like 2026-04.");
            e.RuleFor(x => x).Must(x => string.IsNullOrEmpty(x.End) || string.CompareOrdinal(x.End, x.Start) >= 0)
                .WithName("End").WithMessage("The end date is before the start date.");
            e.RuleFor(x => x.Short).MaximumLength(40);
            e.RuleFor(x => x.Type).MaximumLength(40);
            e.RuleFor(x => x.Metrics).Must(l => l.Count <= 4).WithMessage("Use at most 4 metrics.");
            e.RuleForEach(x => x.Metrics).Must(m => m.Count == 2 && m[0].Length <= 12 && m[1].Length <= 60)
                .WithMessage("Each metric is a short number (12 characters) and a label (60 characters).");
            e.RuleFor(x => x.Bullets).Must(l => l.Count <= 10).WithMessage("Use at most 10 bullets.");
            e.RuleForEach(x => x.Bullets).MaximumLength(500);
            e.RuleFor(x => x.Tags).Must(l => l.Count <= 20).WithMessage("Use at most 20 tags.");
            e.RuleForEach(x => x.Tags).MaximumLength(40);
        });

        RuleFor(x => x.Skills).NotNull().Must(l => l.Count <= 20).WithMessage("Use at most 20 skill categories.");
        RuleForEach(x => x.Skills).ChildRules(s =>
        {
            s.RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
            s.RuleFor(x => x.Desc).MaximumLength(300);
            s.RuleFor(x => x.Items).NotEmpty().Must(l => l.Count <= 60).WithMessage("Use between 1 and 60 skills.");
            s.RuleForEach(x => x.Items).NotEmpty().MaximumLength(60);
        });

        RuleFor(x => x.Services).NotNull().Must(l => l.Count <= 20).WithMessage("Use at most 20 services.")
            .Must(UniqueIds).WithMessage("Two services share the same id.");
        RuleForEach(x => x.Services).ChildRules(s =>
        {
            s.RuleFor(x => x.Id).NotEmpty().MaximumLength(80).Matches(SlugRegex());
            s.RuleFor(x => x.Visual).Must(v => VisualKeys.Contains(v)).WithMessage("Unknown animation.");
            s.RuleFor(x => x.Chip).MaximumLength(60);
            s.RuleFor(x => x.Title).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.Desc).NotEmpty().MaximumLength(500);
            s.RuleFor(x => x.Proof).MaximumLength(240);
        });

        RuleFor(x => x.Clients).NotNull().Must(l => l.Count <= 30).WithMessage("Use at most 30 clients.");
        RuleForEach(x => x.Clients).NotEmpty().MaximumLength(160);

        RuleFor(x => x.Education).NotNull().Must(l => l.Count <= 30).WithMessage("Use at most 30 education items.");
        RuleForEach(x => x.Education).SetValidator(new TextItemValidator());
        RuleFor(x => x.Certifications).NotNull().Must(l => l.Count <= 30).WithMessage("Use at most 30 certifications.");
        RuleForEach(x => x.Certifications).SetValidator(new TextItemValidator());
        RuleFor(x => x.Languages).NotNull().Must(l => l.Count <= 30).WithMessage("Use at most 30 languages.");
        RuleForEach(x => x.Languages).SetValidator(new TextItemValidator());
        RuleFor(x => x.Volunteering).NotNull().Must(l => l.Count <= 30).WithMessage("Use at most 30 volunteering items.");
        RuleForEach(x => x.Volunteering).SetValidator(new TextItemValidator());

        RuleFor(x => x.Cv).NotNull().SetValidator(new CvValidator());
        RuleFor(x => x.Pages).NotNull().SetValidator(new PagesValidator());
    }

    /// <summary>The CV sections the site knows how to draw.</summary>
    public static readonly HashSet<string> CvSectionKeys =
        ["summary", "skills", "experience", "projects", "education", "certifications", "languages", "volunteering"];

    private sealed class CvValidator : AbstractValidator<CvDto>
    {
        public CvValidator()
        {
            RuleFor(x => x.Headline).Must(l => l.Count <= 4).WithMessage("Use at most 4 parts in the CV headline.");
            RuleForEach(x => x.Headline).MaximumLength(60);
            RuleFor(x => x.Summary).MaximumLength(1500);
            RuleFor(x => x.Location).MaximumLength(80);
            RuleFor(x => x.Availability).MaximumLength(80);
            RuleFor(x => x.ProjectStyle).Must(v => v is "summary" or "features" or "both")
                .WithMessage("Project style must be summary, features or both.");
            RuleFor(x => x.Sections).Must(l => l.Count <= CvSectionKeys.Count && l.Select(s => s.Key).Distinct().Count() == l.Count)
                .WithMessage("Each CV section can appear once.");
            RuleForEach(x => x.Sections).ChildRules(s =>
            {
                s.RuleFor(x => x.Key).Must(k => CvSectionKeys.Contains(k)).WithMessage("Unknown CV section.");
                s.RuleFor(x => x.Title).MaximumLength(40);
            });
        }
    }

    private sealed class PagesValidator : AbstractValidator<PagesDto>
    {
        public PagesValidator()
        {
            var page = new PageTextValidator();
            RuleFor(x => x.Home).NotNull().SetValidator(page);
            RuleFor(x => x.About).NotNull().SetValidator(page);
            RuleFor(x => x.Experience).NotNull().SetValidator(page);
            RuleFor(x => x.Projects).NotNull().SetValidator(page);
            RuleFor(x => x.Services).NotNull().SetValidator(page);
            RuleFor(x => x.Cv).NotNull().SetValidator(page);
            RuleFor(x => x.Footer).NotNull().SetValidator(page);
        }
    }

    private sealed class PageTextValidator : AbstractValidator<PageTextDto>
    {
        public PageTextValidator()
        {
            RuleFor(x => x.Kicker).MaximumLength(60);
            RuleFor(x => x.Title).MaximumLength(160);
            RuleFor(x => x.Accent).MaximumLength(80);
            RuleFor(x => x.Intro).MaximumLength(400);
            RuleFor(x => x.Lead).MaximumLength(300);
            RuleFor(x => x.Paragraphs).Must(l => l.Count <= 10).WithMessage("Use at most 10 paragraphs.");
            RuleForEach(x => x.Paragraphs).MaximumLength(1000);
            RuleFor(x => x.Items).Must(l => l.Count <= 24).WithMessage("Use at most 24 items.");
            RuleForEach(x => x.Items).MaximumLength(40);
            RuleFor(x => x.Steps).Must(l => l.Count <= 6).WithMessage("Use at most 6 steps.");
            RuleForEach(x => x.Steps).ChildRules(t =>
            {
                t.RuleFor(x => x.Title).NotEmpty().MaximumLength(60);
                t.RuleFor(x => x.Detail).MaximumLength(300);
            });
        }
    }

    private static bool UniqueIds(List<ProjectDto> items) => items.Select(x => x.Id).Distinct().Count() == items.Count;
    private static bool UniqueIds(List<ExperienceDto> items) => items.Select(x => x.Id).Distinct().Count() == items.Count;
    private static bool UniqueIds(List<ServiceDto> items) => items.Select(x => x.Id).Distinct().Count() == items.Count;

    public static bool BeEmptyOrHttpsUrl(string? value) =>
        string.IsNullOrEmpty(value) ||
        (value.Length <= 300 && Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps);

    private static bool BeEmptyUrlOrDataImage(string? value) =>
        string.IsNullOrEmpty(value) || BeEmptyOrHttpsUrl(value) ||
        (value.StartsWith("data:image/", StringComparison.Ordinal) && value.Length <= 2_000_000);

    private sealed class TextItemValidator : AbstractValidator<TextItemDto>
    {
        public TextItemValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(160);
            RuleFor(x => x.Detail).MaximumLength(300);
        }
    }

    private sealed class ProfileValidator : AbstractValidator<ProfileDto>
    {
        public ProfileValidator()
        {
            RuleFor(x => x.Status).MaximumLength(120);
            RuleFor(x => x.Hello).MaximumLength(80);
            RuleFor(x => x.Headline).NotEmpty().MaximumLength(80);
            RuleFor(x => x.Rotating).NotEmpty().Must(l => l.Count <= 10).WithMessage("Use between 1 and 10 rotating words.");
            RuleForEach(x => x.Rotating).NotEmpty().MaximumLength(40);
            RuleFor(x => x.Intro).MaximumLength(200);
            RuleFor(x => x.IntroRest).MaximumLength(400);
            RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
            RuleFor(x => x.Whatsapp).NotEmpty().Matches(@"^\d{8,15}$")
                .WithMessage("WhatsApp must be digits only, with the country code, like 96171522745.");
            RuleFor(x => x.Phone).MaximumLength(30);
            RuleFor(x => x.Linkedin).NotEmpty().Must(BeEmptyOrHttpsUrl).WithMessage("Enter a full link starting with https://");
            RuleFor(x => x.Github).NotEmpty().Must(BeEmptyOrHttpsUrl).WithMessage("Enter a full link starting with https://");
            RuleFor(x => x.TeamStat).MaximumLength(10);
        }
    }
}

public class ServiceRequestValidator : AbstractValidator<Contracts.ServiceRequestCreate>
{
    public ServiceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Enter your name.").MaximumLength(120);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("Enter a valid email address.").MaximumLength(200);
        RuleFor(x => x.Company).MaximumLength(160);
        RuleFor(x => x.Services).NotEmpty().WithMessage("Pick at least one service.")
            .Must(l => l.Count <= 10).WithMessage("Pick at most 10 services.");
        RuleForEach(x => x.Services).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Timeline).MaximumLength(60);
        RuleFor(x => x.Message).NotEmpty().WithMessage("Describe what you need in a few lines.").MaximumLength(4000);
    }
}

public class EchoRequestValidator : AbstractValidator<Contracts.EchoRequest>
{
    public EchoRequestValidator()
    {
        RuleFor(x => x.Question).NotEmpty().MaximumLength(300);
        RuleFor(x => x.History).Must(h => h.Count <= 12).WithMessage("History is too long.");
        RuleForEach(x => x.History).Must(t => (t.Role is "user" or "assistant") && t.Content.Length <= 1500);
    }
}
