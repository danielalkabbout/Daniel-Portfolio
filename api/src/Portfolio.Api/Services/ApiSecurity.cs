using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;

namespace Portfolio.Api.Services;

/// <summary>
/// The studio session lives in an HttpOnly cookie, so page scripts (and anything injected into them)
/// can never read it. The website reaches the API through its own /api path (a Cloudflare Pages
/// Function), which makes the cookie first-party and lets it be SameSite=Strict.
/// </summary>
public static class SessionCookie
{
    public const string Name = "dk_session";
    private const string Path = "/api";

    public static void Write(HttpContext ctx, string token) =>
        ctx.Response.Cookies.Append(Name, token, Options(ctx));

    public static void Clear(HttpContext ctx) =>
        ctx.Response.Cookies.Delete(Name, Options(ctx));

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

    private static CookieOptions Options(HttpContext ctx) => new()
    {
        HttpOnly = true,
        // Always Secure outside local development (Render ends TLS before the app sees the request).
        Secure = ctx.Request.IsHttps || !ctx.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment(),
        SameSite = SameSiteMode.Strict,
        Path = Path,
        // No expiry date: the cookie is gone when the browser closes. The token inside expires on its own too.
        IsEssential = true,
    };
}

public static class ApiSecurity
{
    public const string EdgeKeyHeader = "X-Edge-Key";
    public const string ClientIpHeader = "X-Client-IP";
    /// <summary>Browsers can't add a custom header to a cross-site form post, so requiring one blocks CSRF.</summary>
    public const string CsrfHeader = "X-Requested-With";

    /// <summary>
    /// Works out the visitor's real IP (for rate limits) and, once Edge:Key is set, only lets the
    /// website's proxy reach anything beyond the public read-only endpoints.
    /// </summary>
    public static IApplicationBuilder UseEdgeGuard(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        // Render puts the connecting address last in X-Forwarded-For.
        if (LastForwarded(ctx.Request) is { } forwarded) ctx.Connection.RemoteIpAddress = forwarded;

        var key = ctx.RequestServices.GetRequiredService<IOptionsMonitor<EdgeOptions>>().CurrentValue.Key;
        if (!string.IsNullOrEmpty(key))
        {
            if (FixedEquals(ctx.Request.Headers[EdgeKeyHeader].ToString(), key))
            {
                // The proxy is trusted, so the visitor IP it reports is too.
                if (IPAddress.TryParse(ctx.Request.Headers[ClientIpHeader].ToString(), out var ip))
                    ctx.Connection.RemoteIpAddress = ip;
            }
            else if (!IsPublicRead(ctx.Request))
            {
                await Reject(ctx, StatusCodes.Status403Forbidden, "Use the website",
                    "This endpoint only accepts requests that come through the website.");
                return;
            }
        }
        // Nothing downstream should ever see these.
        ctx.Request.Headers.Remove(EdgeKeyHeader);
        ctx.Request.Headers.Remove(ClientIpHeader);
        await next();
    });

    /// <summary>Hardening headers on every response, no caching of private data, and the CSRF header check.</summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        var path = ctx.Request.Path;
        var h = ctx.Response.Headers;
        h.XContentTypeOptions = "nosniff";
        h.XFrameOptions = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        h.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
        h["Cross-Origin-Resource-Policy"] = "same-site";
        if (IsPrivate(path))
        {
            h.CacheControl = "no-store";
            h.Pragma = "no-cache";
        }

        var unsafeMethod = !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)
            && !HttpMethods.IsOptions(ctx.Request.Method);
        if (unsafeMethod && path.StartsWithSegments("/api")
            && !ctx.Request.Headers.ContainsKey("Authorization")
            && string.IsNullOrEmpty(ctx.Request.Headers[CsrfHeader].ToString()))
        {
            await Reject(ctx, StatusCodes.Status403Forbidden, "Missing request header",
                $"Requests that change data must send the {CsrfHeader} header.");
            return;
        }
        await next();
    });

    private static bool IsPrivate(PathString path) =>
        path.StartsWithSegments("/api/admin") || path.StartsWithSegments("/api/auth");

    private static bool IsPublicRead(HttpRequest r) =>
        (HttpMethods.IsGet(r.Method) || HttpMethods.IsHead(r.Method) || HttpMethods.IsOptions(r.Method))
        && !IsPrivate(r.Path);

    private static IPAddress? LastForwarded(HttpRequest r)
    {
        var raw = r.Headers["X-Forwarded-For"].ToString();
        if (raw.Length == 0) return null;
        var last = raw[(raw.LastIndexOf(',') + 1)..].Trim();
        return IPAddress.TryParse(last, out var ip) ? ip : null;
    }

    private static bool FixedEquals(string provided, string expected)
    {
        if (provided.Length == 0) return false;
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    private static Task Reject(HttpContext ctx, int status, string title, string detail)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.Headers.CacheControl = "no-store";
        return ctx.Response.WriteAsJsonAsync(
            new { type = "about:blank", title, status, detail },
            options: null, contentType: "application/problem+json");
    }
}
