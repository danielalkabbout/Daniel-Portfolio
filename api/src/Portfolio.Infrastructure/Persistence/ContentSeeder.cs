using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Infrastructure.Persistence;

/// <summary>Imports the content JSON exported from the old Studio (same shape as web/src/content/fallback.json).</summary>
public class ContentSeeder(AppDbContext db, ContentService content)
{
    public async Task<string> SeedAsync(string path, CancellationToken ct = default)
    {
        if (await db.Profiles.AnyAsync(ct))
            return "The database already has content, so seeding was skipped.";
        if (!File.Exists(path))
            return $"Seed file not found: {path}";

        await using var stream = File.OpenRead(path);
        var seed = await JsonSerializer.DeserializeAsync<SiteContentDto>(stream, JsonSerializerOptions.Web, ct)
                   ?? throw new InvalidOperationException("The seed file is empty or invalid.");

        await content.ReplaceAsync(seed, ct);

        return $"Seeded {seed.Projects.Count} projects, {seed.Experience.Count} experience entries, " +
               $"{seed.Skills.Count} skill categories and {seed.Services.Count} services.";
    }
}
