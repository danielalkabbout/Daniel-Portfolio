using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Portfolio.Infrastructure.Content;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string? connectionString)
    {
        // Retries cover short network blips and a free Neon database waking up from sleep.
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString ?? "", npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3)));
        services.AddScoped<ContentService>();
        services.AddScoped<ContentSeeder>();
        services.AddScoped<AuditWriter>();
        return services;
    }
}
