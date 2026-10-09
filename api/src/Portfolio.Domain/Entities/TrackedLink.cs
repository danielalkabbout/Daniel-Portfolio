namespace Portfolio.Domain.Entities;

/// <summary>
/// A personal link you send to one company or person (for example with a job application). Visits that
/// start from it carry its <see cref="Code"/>, so the studio can show when that company opened your site.
/// </summary>
public class TrackedLink
{
    public int Id { get; set; }
    /// <summary>Short random code used in the link (?r=code). It doesn't reveal the label.</summary>
    public string Code { get; set; } = "";
    /// <summary>Who you sent it to, for example "Tradias, backend role".</summary>
    public string Label { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
