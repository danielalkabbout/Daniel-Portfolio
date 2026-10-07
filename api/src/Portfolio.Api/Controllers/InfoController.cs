using Microsoft.AspNetCore.Mvc;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{
    // Render sets RENDER_GIT_COMMIT; the deploy pipeline waits until it matches the commit it shipped.
    private static readonly string Commit = Environment.GetEnvironmentVariable("RENDER_GIT_COMMIT") is { Length: > 0 } c ? c : "local";

    [HttpGet]
    public IActionResult Get() => Ok(new { name = "daniel-portfolio-api", version = "0.7.0", commit = Commit });
}
