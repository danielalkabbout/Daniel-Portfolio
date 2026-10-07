using Portfolio.Domain.Entities;

namespace Portfolio.Infrastructure.Persistence;

/// <summary>Records admin actions in the AuditLogs table.</summary>
public class AuditWriter(AppDbContext db)
{
    public async Task WriteAsync(string action, string entity, string entityId = "", string details = "", CancellationToken ct = default)
    {
        db.AuditLogs.Add(new AuditLog
        {
            Action = Truncate(action, 40),
            Entity = Truncate(entity, 60),
            EntityId = Truncate(entityId, 80),
            Details = Truncate(details, 1000),
            At = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
