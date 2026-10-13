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
    [InlineData("https://l.instagram.com/?u=x", "Instagram")]
    [InlineData("https://l.facebook.com/l.php?u=x", "Facebook")]
    [InlineData("https://lm.facebook.com/", "Facebook")]
    [InlineData("https://web.whatsapp.com/", "WhatsApp")]
    [InlineData("https://l.wl.co/l?u=x", "WhatsApp")]
    [InlineData("https://mail.google.com/", "Gmail")]
    [InlineData("https://www.google.com.lb/", "Google")]
    [InlineData("https://gemini.google.com/app", "Gemini")]
    [InlineData("https://chatgpt.com/", "ChatGPT")]
    [InlineData("https://t.me/somechannel", "Telegram")]
    [InlineData("android-app://com.linkedin.android/", "LinkedIn")]
    [InlineData("android-app://com.instagram.android/", "Instagram")]
    [InlineData("android-app://com.google.android.gm/", "Gmail")]
    [InlineData("https://notfacebook.com/", "notfacebook.com")]
    public void Sources_get_readable_names(string referrer, string expected) =>
        Assert.Equal(expected, VisitTracker.Source(referrer));

    [Theory]
    // Instagram's in-app browser often sends a facebook.com shim as the referrer; the app name wins.
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Instagram 350.0.0.20.94 (iPhone15,2)", "https://l.facebook.com/", "Instagram")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/130.0 Mobile Safari/537.36 Instagram 350.0.0.40.86 Android", "", "Instagram")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]", "", "Facebook")]
    [InlineData("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]", "", "Facebook")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) [FBAN/MessengerForiOS;FBAV/480.0]", "", "Messenger")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 LinkedInApp/9.30", "", "LinkedIn")]
    [InlineData("Mozilla/5.0 (iPhone) Mobile/15E148 MicroMessenger/8.0.50", "", "WeChat")]
    [InlineData("Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36 musical_ly_2023", "", "TikTok")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0", "https://www.linkedin.com/", "LinkedIn")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0", "", "Direct")]
    public void In_app_browsers_name_the_app(string ua, string referrer, string expected) =>
        Assert.Equal(expected, VisitTracker.Source(referrer, ua));

    [Theory]
    [InlineData("ig", "Instagram")]
    [InlineData("LinkedIn", "LinkedIn")]
    [InlineData("wa", "WhatsApp")]
    [InlineData("conference", "Conference")]
    [InlineData("<script>", "Direct")]
    public void Utm_source_wins_when_present(string utm, string expected) =>
        Assert.Equal(expected, VisitTracker.Source("", null, utm));

    [Theory]
    [InlineData("Instagram", "Social")]
    [InlineData("WhatsApp", "Messaging")]
    [InlineData("Gmail", "Email")]
    [InlineData("Google", "Search")]
    [InlineData("ChatGPT", "AI")]
    [InlineData("Direct", "Direct")]
    [InlineData("news.example.org", "Website")]
    public void Sources_have_a_channel(string source, string expected) =>
        Assert.Equal(expected, VisitTracker.Channel(source));

    [Theory]
    // A phone in Lebanon whose traffic leaves through a US address (VPN, Private Relay, carrier) is still Lebanon.
    [InlineData("US", "Asia/Beirut", "LB")]
    [InlineData("US", "America/New_York", "US")]
    [InlineData("DE", "Asia/Calcutta", "IN")]
    [InlineData("FR", "UTC", "FR")]
    [InlineData("FR", "", "FR")]
    [InlineData("", "Not/AZone", "")]
    public void The_time_zone_decides_the_country(string ip, string tz, string expected) =>
        Assert.Equal(expected, VisitTracker.Country(ip, tz));

    [Theory]
    [InlineData("0123456789abcdef", "0123456789abcdef")]
    [InlineData("ABCDEF0123456789", "abcdef0123456789")]
    [InlineData("short", "")]
    [InlineData("has spaces in it!", "")]
    [InlineData(null, "")]
    public void Session_ids_are_checked(string? id, string expected) =>
        Assert.Equal(expected, VisitTracker.Session(id));

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
