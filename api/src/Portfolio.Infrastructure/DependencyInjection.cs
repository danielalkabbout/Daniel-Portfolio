using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Portfolio.Infrastructure.Content;
using Portfolio.Infrastructure.Persistence;

namespace Portfolio.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string? connectionString)
    {
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString ?? ""));
        services.AddScoped<ContentService>();
        services.AddScoped<ContentSeeder>();
        services.AddScoped<AuditWriter>();
        return services;
    }
}
