using Portfolio.Domain.Common;

namespace Portfolio.Domain.Entities;

/// <summary>Single row (Id = 1): home intro and contact details.</summary>
public class Profile : IAuditable
{
    public int Id { get; set; }
    public string Status { get; set; } = "";
    public string Hello { get; set; } = "";
    public string Headline { get; set; } = "";
    public List<string> RotatingWords { get; set; } = [];
    public string Intro { get; set; } = "";
    public string IntroRest { get; set; } = "";
    public string Email { get; set; } = "";
    public string WhatsApp { get; set; } = "";
    public string Phone { get; set; } = "";
    public string LinkedInUrl { get; set; } = "";
    public string GitHubUrl { get; set; } = "";
    public string TeamStat { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
