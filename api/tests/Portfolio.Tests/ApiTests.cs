using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Portfolio.Api.Contracts;
using Portfolio.Infrastructure.Content;

namespace Portfolio.Tests;

[Collection(DbCollection.Name)]
public class ApiTests(ApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await factory.AdminTokenAsync());
        return client;
    }

    [SkippableFact]
    public async Task Public_content_is_served_after_seed()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var site = await factory.CreateClient().GetFromJsonAsync<SiteContentDto>("/api/content", Json);
        Assert.NotNull(site);
        Assert.Contains(site.Projects, p => p.Id == "sharepoint-ldap");
        Assert.Contains(site.Experience, e => e.End is null && !e.Milestone);
        Assert.NotEmpty(site.Clients);
    }

    [SkippableFact]
    public async Task Admin_endpoints_require_a_token()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var response = await factory.CreateClient().GetAsync("/api/admin/content");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableFact]
    public async Task Wrong_password_is_rejected()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var response = await SrpClient.LoginAsync(factory.CreateClient(), ApiFactory.AdminEmail, "not the password");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SkippableFact]
    public async Task Saving_content_updates_the_public_site()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        var site = await admin.GetFromJsonAsync<SiteContentDto>("/api/admin/content", Json);
        site!.Profile.Status = "Status changed by a test";

        var save = await admin.PutAsJsonAsync("/api/admin/content", site, Json);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        var publicSite = await factory.CreateClient().GetFromJsonAsync<SiteContentDto>("/api/content", Json);
        Assert.Equal("Status changed by a test", publicSite!.Profile.Status);
    }

    [SkippableFact]
    public async Task CV_settings_and_page_text_are_saved()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        var site = await admin.GetFromJsonAsync<SiteContentDto>("/api/admin/content", Json);
        site!.Cv.Summary = "A summary written in the studio.";
        site.Cv.Headline = ["AI Engineer", "Tech Lead"];
        site.Cv.Sections = [new CvSectionDto { Key = "experience", Title = "Work" }, new CvSectionDto { Key = "summary", Visible = false }];
        site.Pages.About.Title = "About title from the studio";
        site.Pages.Home.Items = ["Teams", "WhatsApp"];
        site.Projects[0].Cv = false;
        site.Projects[1].CvBullets = ["First CV bullet", "Second CV bullet"];
        site.Experience[0].Cv = false;

        var save = await admin.PutAsJsonAsync("/api/admin/content", site, Json);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        var body = await save.Content.ReadAsStringAsync();
        Assert.Contains("\"cv\"", body);
        Assert.Contains("\"pages\"", body);

        var saved = await factory.CreateClient().GetFromJsonAsync<SiteContentDto>("/api/content", Json);
        Assert.Equal("A summary written in the studio.", saved!.Cv.Summary);
        Assert.Equal(new[] { "AI Engineer", "Tech Lead" }, saved.Cv.Headline);
        Assert.Equal("Work", saved.Cv.Sections[0].Title);
        Assert.False(saved.Cv.Sections[1].Visible);
        Assert.Equal("About title from the studio", saved.Pages.About.Title);
        Assert.Equal(new[] { "Teams", "WhatsApp" }, saved.Pages.Home.Items);
        Assert.False(saved.Projects.Single(p => p.Id == site.Projects[0].Id).Cv);
        Assert.Equal(new[] { "First CV bullet", "Second CV bullet" }, saved.Projects.Single(p => p.Id == site.Projects[1].Id).CvBullets);
        Assert.False(saved.Experience.Single(e => e.Id == site.Experience[0].Id).Cv);
    }

    [SkippableFact]
    public async Task Email_status_is_reported_and_tests_need_a_key()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        var status = await admin.GetFromJsonAsync<JsonElement>("/api/admin/notifications", Json);
        Assert.False(status.GetProperty("email").GetBoolean());

        var test = await admin.PostAsync("/api/admin/notifications/test", null);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, test.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/notifications")).StatusCode);
    }

    [SkippableFact]
    public async Task Visits_are_counted_anonymously_and_shown_to_the_admin()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148");
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/track", new { kind = "view", path = "/projects/booking", referrer = "https://www.linkedin.com/" })).StatusCode);
        await client.PostAsJsonAsync("/api/track", new { kind = "cv", path = "/cv" });
        await client.PostAsJsonAsync("/api/track", new { kind = "view", path = "/admin" });

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/visits")).StatusCode);
        var stats = await (await AdminClientAsync()).GetFromJsonAsync<JsonElement>("/api/admin/visits?days=7", Json);
        Assert.True(stats.GetProperty("views").GetInt32() >= 1);
        Assert.True(stats.GetProperty("cvDownloads").GetInt32() >= 1);
        Assert.Contains(stats.GetProperty("sources").EnumerateArray(), s => s.GetProperty("name").GetString() == "LinkedIn");
        Assert.Contains(stats.GetProperty("projects").EnumerateArray(), s => s.GetProperty("name").GetString() == "booking");
        Assert.DoesNotContain(stats.GetProperty("pages").EnumerateArray(), s => s.GetProperty("name").GetString() == "/admin");
    }

    [SkippableFact]
    public async Task Visits_without_a_link_are_listed_separately_with_what_they_did()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var visitor = factory.CreateClient();
        visitor.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        visitor.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Instagram 350.0.0.20.94 (iPhone15,2)");
        visitor.DefaultRequestHeaders.Add("X-Visitor-Country", "US");
        var session = Convert.ToHexStringLower(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8));
        foreach (var (kind, path) in new[] { ("view", "/"), ("view", "/projects/whatsapp"), ("cv", "/cv") })
            await visitor.PostAsJsonAsync("/api/track",
                new { kind, path, referrer = "https://l.facebook.com/", tz = "Asia/Beirut", session });

        var admin = await AdminClientAsync();
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits/sessions?days=1&kind=other", Json);
        var mine = list.GetProperty("sessions").EnumerateArray().Select(x => x.GetProperty("visit"))
            .First(v => v.GetProperty("pages").EnumerateArray().Any(p => p.GetString() == "/projects/whatsapp")
                && v.GetProperty("source").GetString() == "Instagram");
        Assert.Equal("LB", mine.GetProperty("country").GetString());
        Assert.Equal("Social", mine.GetProperty("channel").GetString());
        Assert.True(mine.GetProperty("cv").GetBoolean());
        Assert.Equal(new[] { "/", "/projects/whatsapp", "/cv" },
            mine.GetProperty("steps").EnumerateArray().Select(p => p.GetProperty("path").GetString()!).ToArray());

        var links = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits/sessions?days=1&kind=links", Json);
        Assert.DoesNotContain(links.GetProperty("sessions").EnumerateArray(),
            x => x.GetProperty("visit").GetProperty("source").GetString() == "Instagram"
                && x.GetProperty("visit").GetProperty("country").GetString() == "LB");
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/visits/sessions")).StatusCode);
    }

    [SkippableFact]
    public async Task Time_on_each_page_is_recorded_and_live_visitors_are_shown()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var visitor = factory.CreateClient();
        visitor.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        visitor.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0");
        var session = Convert.ToHexStringLower(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8));
        object Body(string kind, string path, int? seconds = null, bool? leaving = null) =>
            new { kind, path, tz = "Asia/Beirut", session, seconds, leaving, referrer = "https://www.bing.com/" };

        await visitor.PostAsJsonAsync("/api/track", Body("view", "/"));
        var admin = await AdminClientAsync();
        var live = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits/live", Json);
        Assert.Contains(live.GetProperty("visitors").EnumerateArray(), v => v.GetProperty("source").GetString() == "Bing");

        await visitor.PostAsJsonAsync("/api/track", Body("time", "/", 42));
        await visitor.PostAsJsonAsync("/api/track", Body("view", "/projects/noise"));
        // Out-of-range times are ignored.
        await visitor.PostAsJsonAsync("/api/track", Body("time", "/", 999999));
        await visitor.PostAsJsonAsync("/api/track", Body("time", "/projects/noise", 75, true));

        live = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits/live", Json);
        Assert.DoesNotContain(live.GetProperty("visitors").EnumerateArray(), v => v.GetProperty("source").GetString() == "Bing");

        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits/sessions?days=1&kind=other", Json);
        var mine = list.GetProperty("sessions").EnumerateArray().Select(x => x.GetProperty("visit"))
            .First(v => v.GetProperty("source").GetString() == "Bing");
        Assert.Equal(117, mine.GetProperty("seconds").GetInt32());
        var steps = mine.GetProperty("steps").EnumerateArray().ToList();
        Assert.Equal(new[] { "/", "/projects/noise" }, steps.Select(x => x.GetProperty("path").GetString()!).ToArray());
        Assert.Equal(new[] { 42, 75 }, steps.Select(x => x.GetProperty("seconds").GetInt32()).ToArray());

        var stats = await admin.GetFromJsonAsync<JsonElement>("/api/admin/visits?days=1", Json);
        Assert.True(stats.GetProperty("avgSeconds").GetInt32() > 0);
        Assert.Contains(stats.GetProperty("pageTime").EnumerateArray(), p => p.GetProperty("name").GetString() == "/projects/noise");
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/visits/live")).StatusCode);
    }

    [SkippableFact]
    public async Task Data_centre_browsers_are_not_counted()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var bot = factory.CreateClient();
        bot.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        bot.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0");
        bot.DefaultRequestHeaders.Add("X-Visitor-Country", "US");
        bot.DefaultRequestHeaders.Add("X-Visitor-Org", "DigitalOcean, LLC");
        await bot.PostAsJsonAsync("/api/track", new { kind = "view", path = "/projects/todo", tz = "America/New_York", referrer = "https://duckduckgo.com/" });

        var list = await (await AdminClientAsync()).GetFromJsonAsync<JsonElement>("/api/admin/visits/sessions?days=1&kind=other", Json);
        Assert.DoesNotContain(list.GetProperty("sessions").EnumerateArray(),
            x => x.GetProperty("visit").GetProperty("source").GetString() == "DuckDuckGo");
    }

    [SkippableFact]
    public async Task Personal_links_show_who_opened_the_site()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        admin.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        var created = await admin.PostAsJsonAsync("/api/admin/links", new { label = "Tradias, backend role" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var link = await created.Content.ReadFromJsonAsync<JsonElement>(Json);
        var code = link.GetProperty("code").GetString()!;
        Assert.Matches("^[a-z0-9]{6}$", code);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/links", new { label = "" })).StatusCode);

        var visitor = factory.CreateClient();
        visitor.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        visitor.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0");
        await visitor.PostAsJsonAsync("/api/track", new { kind = "view", path = "/", @ref = code });
        await visitor.PostAsJsonAsync("/api/track", new { kind = "view", path = "/projects/whatsapp", @ref = code });
        await visitor.PostAsJsonAsync("/api/track", new { kind = "cv", path = "/cv", @ref = code });
        await visitor.PostAsJsonAsync("/api/track", new { kind = "view", path = "/", @ref = "nosuchcode" });

        var links = await admin.GetFromJsonAsync<JsonElement>("/api/admin/links", Json);
        var mine = links.EnumerateArray().Single(l => l.GetProperty("code").GetString() == code);
        Assert.Equal(2, mine.GetProperty("visits").GetInt32());
        Assert.True(mine.GetProperty("cv").GetBoolean());
        var session = mine.GetProperty("history")[0];
        Assert.Equal(new[] { "/", "/projects/whatsapp" }, session.GetProperty("pages").EnumerateArray().Select(p => p.GetString()!).ToArray());

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/links")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/links/{link.GetProperty("id").GetInt32()}")).StatusCode);
    }

    [SkippableFact]
    public async Task Echo_ai_test_says_when_it_is_off()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        admin.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await admin.PostAsync("/api/admin/echo/test", null)).StatusCode);
        var anon = factory.CreateClient();
        anon.DefaultRequestHeaders.Add("X-Requested-With", "fetch");
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsync("/api/admin/echo/test", null)).StatusCode);
    }

    [SkippableFact]
    public async Task Invalid_content_is_rejected()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var admin = await AdminClientAsync();
        var site = await admin.GetFromJsonAsync<SiteContentDto>("/api/admin/content", Json);
        site!.Profile.Headline = "";
        var save = await admin.PutAsJsonAsync("/api/admin/content", site, Json);
        Assert.Equal(HttpStatusCode.BadRequest, save.StatusCode);
    }

    [SkippableFact]
    public async Task Request_form_saves_a_request()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var form = new ServiceRequestCreate
        {
            Name = "Test Client",
            Email = "client@example.com",
            Services = ["AI agent"],
            Message = "We need an HR agent in Teams.",
        };
        var created = await factory.CreateClient().PostAsJsonAsync("/api/requests", form, Json);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var admin = await AdminClientAsync();
        var list = await admin.GetStringAsync("/api/admin/requests");
        Assert.Contains("client@example.com", list);
    }

    [SkippableFact]
    public async Task Bots_filling_the_hidden_field_are_ignored()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var form = new ServiceRequestCreate
        {
            Name = "Bot", Email = "bot@example.com", Services = ["AI agent"], Message = "spam", Website = "http://spam",
        };
        var response = await factory.CreateClient().PostAsJsonAsync("/api/requests", form, Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var admin = await AdminClientAsync();
        Assert.DoesNotContain("bot@example.com", await admin.GetStringAsync("/api/admin/requests"));
    }

    [SkippableFact]
    public async Task Echo_reports_unavailable_without_a_key()
    {
        Skip.IfNot(factory.Enabled, "TEST_DB is not set");
        var response = await factory.CreateClient().PostAsJsonAsync("/api/echo", new EchoRequest { Question = "Hi" }, Json);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }
}
