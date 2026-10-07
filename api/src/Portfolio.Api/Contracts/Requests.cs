namespace Portfolio.Api.Contracts;

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(string Token, DateTime ExpiresAt);

public sealed class ServiceRequestCreate
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Company { get; set; } = "";
    public List<string> Services { get; set; } = [];
    public string Timeline { get; set; } = "";
    public string Message { get; set; } = "";
    public string TurnstileToken { get; set; } = "";
    /// <summary>Hidden field humans never fill in. If it has a value, the request is from a bot.</summary>
    public string Website { get; set; } = "";
}

public sealed record ServiceRequestStatusUpdate(string Status);

public sealed class EchoRequest
{
    public string Question { get; set; } = "";
    public List<EchoTurn> History { get; set; } = [];
}

public sealed record EchoTurn(string Role, string Content);

public sealed record EchoResponse(string Answer);
