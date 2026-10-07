using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

public enum ServiceRequestStatus
{
    New,
    Read,
    Replied,
    Archived
}

/// <summary>Submitted from the request form on the Services page.</summary>
public class ServiceRequest : IAuditable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Company { get; set; } = "";
    public List<string> Services { get; set; } = [];
    public string Timeline { get; set; } = "";
    public string Message { get; set; } = "";
    public ServiceRequestStatus Status { get; set; } = ServiceRequestStatus.New;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
