using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

public class SkillCategory : IAuditable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> Items { get; set; } = [];
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
