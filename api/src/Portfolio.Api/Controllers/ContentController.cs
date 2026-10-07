using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Api.Controllers;

/// <summary>Public, read-only content for the website.</summary>
[ApiController]
[Route("api/content")]
public class ContentController(ContentService content) : ControllerBase
{
    public const string CacheTag = "content";

    [HttpGet]
    [OutputCache(PolicyName = CacheTag)]
    [ProducesResponseType<SiteContentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var site = await content.GetAsync(ct);
        return site is null
            ? Problem(statusCode: 404, title: "No content yet", detail: "Run the seed command to import the portfolio content.")
            : Ok(site);
    }
}
