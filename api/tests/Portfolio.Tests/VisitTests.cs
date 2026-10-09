using Portfolio.Api.Services;

namespace Portfolio.Tests;

public class VisitTests
{
    [Theory]
    [InlineData("https://www.linkedin.com/feed/", "LinkedIn")]
    [InlineData("https://lnkd.in/abc", "LinkedIn")]
    [InlineData("https://www.google.com/", "Google")]
    [InlineData("https://github.com/danielalkabbout", "GitHub")]
    [InlineData("https://news.example.org/post", "news.example.org")]
    [InlineData("", "Direct")]
    [InlineData("not a url", "Direct")]
    public void Sources_get_readable_names(string referrer, string expected) =>
        Assert.Equal(expected, VisitTracker.Source(referrer, null));

    [Theory]
    [InlineData("/", "/")]
    [InlineData("/Projects/Booking/", "/projects/booking")]
    [InlineData("/cv?x=1#top", "/cv")]
    [InlineData("/admin", null)]
    [InlineData("/admin/cv", null)]
    [InlineData("/api/content", null)]
    [InlineData("/<script>", null)]
    public void Only_real_pages_are_counted(string path, string? expected) =>
        Assert.Equal(expected, VisitTracker.CleanPath(path));

    [Fact]
    public void Bots_and_devices_are_told_apart()
    {
        Assert.True(VisitTracker.IsBot("Mozilla/5.0 (compatible; Googlebot/2.1)"));
        Assert.True(VisitTracker.IsBot("LinkedInBot/1.0"));
        Assert.True(VisitTracker.IsBot(""));
        Assert.False(VisitTracker.IsBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148"));
        Assert.Equal("Mobile", VisitTracker.Device("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148"));
        Assert.Equal("Tablet", VisitTracker.Device("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"));
        Assert.Equal("Desktop", VisitTracker.Device("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0"));
    }

    [Fact]
    public void The_visitor_hash_is_stable_for_a_day_and_never_the_ip()
    {
        var t = new VisitTracker();
        var a = t.VisitorHash("203.0.113.7", "UA");
        Assert.Equal(a, t.VisitorHash("203.0.113.7", "UA"));
        Assert.NotEqual(a, t.VisitorHash("203.0.113.8", "UA"));
        Assert.Equal(16, a.Length);
        Assert.DoesNotContain("203", a);
        Assert.NotEqual(a, new VisitTracker().VisitorHash("203.0.113.7", "UA"));
    }

    [Theory]
    [InlineData("lb", "LB")]
    [InlineData("XX", "")]
    [InlineData("T1", "")]
    [InlineData("", "")]
    public void Countries_are_two_letters(string code, string expected) =>
        Assert.Equal(expected, VisitTracker.Country(code));
}
