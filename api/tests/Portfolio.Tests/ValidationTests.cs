using System.Text.Json;
using Portfolio.Api.Services;
using Portfolio.Api.Validation;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Tests;

public class ValidationTests
{
    private static SiteContentDto LoadSeed() =>
        JsonSerializer.Deserialize<SiteContentDto>(File.ReadAllText(TestPaths.SeedFile()), JsonSerializerOptions.Web)!;

    [Fact]
    public void Seed_content_passes_validation()
    {
        var result = new SiteContentValidator().Validate(LoadSeed());
        Assert.True(result.IsValid, string.Join("\n", result.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}")));
    }

    [Fact]
    public void Unknown_or_repeated_CV_sections_are_rejected()
    {
        var site = LoadSeed();
        site.Cv.Sections = [new CvSectionDto { Key = "summary" }, new CvSectionDto { Key = "summary" }];
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
        site.Cv.Sections = [new CvSectionDto { Key = "hobbies" }];
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
        site.Cv.Sections = [new CvSectionDto { Key = "projects", Title = "Selected work", Visible = false }];
        site.Cv.ProjectStyle = "both";
        Assert.True(new SiteContentValidator().Validate(site).IsValid);
        site.Cv.ProjectStyle = "everything";
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
    }

    [Fact]
    public void Bad_project_id_is_rejected()
    {
        var site = LoadSeed();
        site.Projects[0].Id = "Bad Id!";
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
    }

    [Fact]
    public void End_before_start_is_rejected()
    {
        var site = LoadSeed();
        var role = site.Experience.First(e => !e.Milestone);
        role.Start = "2026-05";
        role.End = "2026-01";
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
    }

    [Fact]
    public void Duplicate_project_ids_are_rejected()
    {
        var site = LoadSeed();
        site.Projects[1].Id = site.Projects[0].Id;
        Assert.False(new SiteContentValidator().Validate(site).IsValid);
    }

    [Fact]
    public void Echo_facts_include_projects_and_contact()
    {
        var facts = EchoAssistant.BuildFacts(LoadSeed());
        Assert.Contains("WhatsApp AI Assistant for Microsoft 365", facts);
        Assert.Contains("danielalkabbout@gmail.com", facts);
    }

    [Fact]
    public void Media_check_accepts_png_and_rejects_text()
    {
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
        Assert.True(MediaStorage.LooksLikeImage(png, "image/png"));
        Assert.False(MediaStorage.LooksLikeImage("not an image"u8, "image/png"));
    }
}
