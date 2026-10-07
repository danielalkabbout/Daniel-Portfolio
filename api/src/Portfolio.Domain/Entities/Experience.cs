using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>A role, or a milestone such as a graduation (IsMilestone = true).</summary>
public class Experience : IAuditable
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string ShortLabel { get; set; } = "";
    public string Organization { get; set; } = "";
    public DateOnly StartDate { get; set; }
    /// <summary>Null means the role is current.</summary>
    public DateOnly? EndDate { get; set; }
    /// <summary>Badge such as "Internship" or "Part-time internship". Empty for none.</summary>
    public string BadgeType { get; set; } = "";
    public List<ExperienceMetric> Metrics { get; set; } = [];
    public List<string> Bullets { get; set; } = [];
    public List<string> Tags { get; set; } = [];
    public bool IsMilestone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Stored as JSON inside the Experiences row.</summary>
public class ExperienceMetric
{
    public string Value { get; set; } = "";
    public string Label { get; set; } = "";
}
