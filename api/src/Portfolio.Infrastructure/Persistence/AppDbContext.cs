using Microsoft.EntityFrameworkCore;
using Portfolio.Domain.Common;
using Portfolio.Domain.Entities;

namespace Portfolio.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Highlight> Highlights => Set<Highlight>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Experience> Experiences => Set<Experience>();
    public DbSet<SkillCategory> SkillCategories => Set<SkillCategory>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<AboutItem> AboutItems => Set<AboutItem>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AdminAccount> AdminAccounts => Set<AdminAccount>();
    public DbSet<ContentDocument> ContentDocuments => Set<ContentDocument>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<TrackedLink> TrackedLinks => Set<TrackedLink>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // List<string> properties map to PostgreSQL text[] arrays automatically.

        b.Entity<Profile>(e =>
        {
            e.Property(x => x.Status).HasMaxLength(120);
            e.Property(x => x.Hello).HasMaxLength(80);
            e.Property(x => x.Headline).HasMaxLength(80);
            e.Property(x => x.Intro).HasMaxLength(200);
            e.Property(x => x.IntroRest).HasMaxLength(400);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.WhatsApp).HasMaxLength(20);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.LinkedInUrl).HasMaxLength(300);
            e.Property(x => x.GitHubUrl).HasMaxLength(300);
            e.Property(x => x.TeamStat).HasMaxLength(10);
        });

        b.Entity<Highlight>(e =>
        {
            e.Property(x => x.Number).HasMaxLength(12);
            e.Property(x => x.Label).HasMaxLength(160);
        });

        b.Entity<Project>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.Title).HasMaxLength(120);
            e.Property(x => x.ShortName).HasMaxLength(60);
            e.Property(x => x.Kind).HasMaxLength(80);
            e.Property(x => x.Tagline).HasMaxLength(60);
            e.Property(x => x.Summary).HasMaxLength(600);
            e.Property(x => x.ReelText).HasMaxLength(300);
            e.Property(x => x.GitHubUrl).HasMaxLength(300);
            e.Property(x => x.LiveUrl).HasMaxLength(300);
            e.Property(x => x.DemoKey).HasMaxLength(30);
            e.Property(x => x.Icon).HasMaxLength(30);
            // ImageUrl stays unlimited text: it holds an R2 URL (or a data URI from the old Studio)
        });

        b.Entity<Experience>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.Title).HasMaxLength(120);
            e.Property(x => x.ShortLabel).HasMaxLength(40);
            e.Property(x => x.Organization).HasMaxLength(120);
            e.Property(x => x.BadgeType).HasMaxLength(40);
            e.OwnsMany(x => x.Metrics, m => m.ToJson());
        });

        b.Entity<SkillCategory>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Description).HasMaxLength(300);
        });

        b.Entity<Service>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.VisualKey).HasMaxLength(20);
            e.Property(x => x.ChipLabel).HasMaxLength(60);
            e.Property(x => x.Title).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Proof).HasMaxLength(240);
        });

        b.Entity<AboutItem>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Title).HasMaxLength(160);
            e.Property(x => x.Detail).HasMaxLength(300);
            e.HasIndex(x => new { x.Type, x.SortOrder });
        });

        b.Entity<ServiceRequest>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Company).HasMaxLength(160);
            e.Property(x => x.Timeline).HasMaxLength(60);
            e.Property(x => x.Message).HasMaxLength(4000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.CreatedAt);
        });

        b.Entity<AuditLog>(e =>
        {
            e.Property(x => x.Action).HasMaxLength(40);
            e.Property(x => x.Entity).HasMaxLength(60);
            e.Property(x => x.EntityId).HasMaxLength(80);
            e.Property(x => x.Details).HasMaxLength(1000);
            e.HasIndex(x => x.At);
        });

        b.Entity<Visit>(e =>
        {
            e.Property(x => x.Kind).HasMaxLength(10);
            e.Property(x => x.Path).HasMaxLength(200);
            e.Property(x => x.Source).HasMaxLength(60);
            e.Property(x => x.Country).HasMaxLength(2);
            e.Property(x => x.Device).HasMaxLength(10);
            e.Property(x => x.Visitor).HasMaxLength(16);
            e.Property(x => x.Ref).HasMaxLength(12).HasDefaultValue("");
            e.HasIndex(x => x.At);
            e.HasIndex(x => x.Ref);
        });

        b.Entity<TrackedLink>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(12);
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Label).HasMaxLength(80);
            e.Property(x => x.Note).HasMaxLength(200);
        });

        b.Entity<ContentDocument>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(40);
            e.Property(x => x.Json).HasColumnType("jsonb");
        });

        b.Entity<AdminAccount>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.SrpSalt).HasMaxLength(64);
            e.Property(x => x.SrpVerifier).HasMaxLength(600);
            e.Property(x => x.SecurityStamp).HasMaxLength(64);
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTimes();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampTimes();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTimes()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}
