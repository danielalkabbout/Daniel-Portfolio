using System.Collections.Concurrent;

namespace Portfolio.Api.Services;

/// <summary>Someone on the site right now: when their visit started, and where they are.</summary>
public sealed record LiveVisit(
    string Session, DateTime StartedAt, DateTime LastSeen, string Path, string Source, string Country, string Device, string Ref);

/// <summary>
/// Who is on the site right now, kept in memory only. The site sends a small heartbeat every 30 seconds
/// while its tab is visible and the visitor is active, and says when they leave; anyone not heard from for
/// 75 seconds is treated as gone. Nothing here is saved to the database.
/// </summary>
public sealed class LiveVisitors(TimeProvider clock)
{
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(75);
    private const int Max = 1000;
    private readonly ConcurrentDictionary<string, LiveVisit> visits = new();

    public void Touch(string session, string path, string source, string country, string device, string reference)
    {
        if (session.Length == 0) return;
        var now = clock.GetUtcNow().UtcDateTime;
        if (visits.Count >= Max && !visits.ContainsKey(session)) Prune(now);
        if (visits.Count >= Max && !visits.ContainsKey(session)) return;
        visits.AddOrUpdate(session,
            _ => new LiveVisit(session, now, now, path, source, country, device, reference),
            (_, v) => v.LastSeen + Timeout < now
                ? new LiveVisit(session, now, now, path, source, country, device, reference)
                : v with { LastSeen = now, Path = path });
    }

    public void End(string session)
    {
        if (session.Length > 0) visits.TryRemove(session, out _);
    }

    public IReadOnlyList<LiveVisit> Now()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        Prune(now);
        return [.. visits.Values.OrderBy(v => v.StartedAt)];
    }

    private void Prune(DateTime now)
    {
        foreach (var (key, v) in visits)
            if (v.LastSeen + Timeout < now) visits.TryRemove(key, out _);
    }
}
