namespace Portfolio.Api.Options;

/// <summary>
/// Optional first-run login. When the database has no admin account yet, the first sign-in with these
/// values creates it in the database; after that the database is the only source of truth.
/// PasswordHash comes from: dotnet run --project src/Portfolio.Api -- hash-password
/// </summary>
public sealed class AdminOptions
{
    public const string Section = "Admin";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
}

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    /// <summary>At least 32 characters. Generate one with: dotnet run --project src/Portfolio.Api -- new-jwt-key</summary>
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "portfolio-api";
    public string Audience { get; set; } = "portfolio-admin";
    public int ExpiryHours { get; set; } = 8;
}

public sealed class GeminiOptions
{
    public const string Section = "Gemini";
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "gemini-flash-latest";
}

public sealed class TurnstileOptions
{
    public const string Section = "Turnstile";
    /// <summary>Leave empty in development to skip bot checks.</summary>
    public string Secret { get; set; } = "";
}

public sealed class R2Options
{
    public const string Section = "R2";
    public string AccountId { get; set; } = "";
    public string AccessKeyId { get; set; } = "";
    public string SecretAccessKey { get; set; } = "";
    public string Bucket { get; set; } = "";
    /// <summary>Public base URL of the bucket, e.g. https://pub-xxxx.r2.dev</summary>
    public string PublicBaseUrl { get; set; } = "";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountId) && !string.IsNullOrWhiteSpace(AccessKeyId) &&
        !string.IsNullOrWhiteSpace(SecretAccessKey) && !string.IsNullOrWhiteSpace(Bucket) &&
        !string.IsNullOrWhiteSpace(PublicBaseUrl);
}

public sealed class EmailOptions
{
    public const string Section = "Email";
    /// <summary>Resend API key. Leave empty to skip email notifications.</summary>
    public string ResendApiKey { get; set; } = "";
    public string From { get; set; } = "Portfolio <onboarding@resend.dev>";
    public string To { get; set; } = "";
}

public sealed class PublishOptions
{
    public const string Section = "Pages";
    /// <summary>Cloudflare Pages deploy hook URL. Calling it rebuilds the public site.</summary>
    public string DeployHookUrl { get; set; } = "";
}
