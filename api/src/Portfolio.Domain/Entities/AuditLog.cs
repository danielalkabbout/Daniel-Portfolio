namespace Portfolio.Domain.Entities;

/// <summary>One row per admin change: what happened, to what, and when.</summary>
public class AuditLog
{
    public long Id { get; set; }
    public string Action { get; set; } = "";
    public string Entity { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTime At { get; set; }
}
