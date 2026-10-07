using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Portfolio.Api.Options;

namespace Portfolio.Api.Services;

public class TokenService(IOptions<JwtOptions> options)
{
    public (string Token, DateTime ExpiresAt) Create(string email)
    {
        var o = options.Value;
        var expires = DateTime.UtcNow.AddHours(o.ExpiryHours);
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = o.Issuer,
            Audience = o.Audience,
            Expires = expires,
            Subject = new ClaimsIdentity([new Claim("sub", email), new Claim("role", "admin")]),
            SigningCredentials = new SigningCredentials(SigningKey(o.Key), SecurityAlgorithms.HmacSha256),
        };
        return (new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }

    public static SymmetricSecurityKey SigningKey(string key) => new(Encoding.UTF8.GetBytes(key));
}
