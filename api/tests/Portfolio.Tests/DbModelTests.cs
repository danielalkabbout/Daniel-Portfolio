using Microsoft.EntityFrameworkCore;
using Portfolio.Domain.Entities;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Tests;

/// <summary>Builds the EF Core model without a database, so mapping mistakes fail here instead of at migration time.</summary>
public class DbModelTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=localhost;Database=model_only").Options);

    [Fact]
    public void Model_builds_and_contains_all_tables()
    {
        using var db = CreateContext();
        var tables = db.Model.GetEntityTypes()
            .Where(t => !t.IsOwned())
            .Select(t => t.GetTableName())
            .ToHashSet();

        Assert.Contains("Projects", tables);
        Assert.Contains("Experiences", tables);
        Assert.Contains("SkillCategories", tables);
        Assert.Contains("Services", tables);
        Assert.Contains("AboutItems", tables);
        Assert.Contains("ServiceRequests", tables);
        Assert.Contains("AuditLogs", tables);
    }

    [Fact]
    public void Project_slug_is_unique()
    {
        using var db = CreateContext();
        var index = db.Model.FindEntityType(typeof(Project))!
            .GetIndexes()
            .Single(i => i.Properties.Any(p => p.Name == nameof(Project.Slug)));
        Assert.True(index.IsUnique);
    }
}
