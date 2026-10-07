using Microsoft.AspNetCore.Mvc;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { name = "daniel-portfolio-api", version = "0.5.0" });
}
