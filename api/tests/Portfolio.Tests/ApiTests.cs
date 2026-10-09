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
