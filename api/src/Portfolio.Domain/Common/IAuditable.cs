namespace Portfolio.Domain.Common;

/// <summary>Entities with automatic created/updated timestamps (set in AppDbContext.SaveChanges).</summary>
public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}
