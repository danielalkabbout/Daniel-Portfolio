namespace Portfolio.Tests;

internal static class TestPaths
{
    /// <summary>Finds api/src/Portfolio.Api/SeedData/content-seed.json by walking up from the test folder.</summary>
    public static string SeedFile()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "Portfolio.Api", "SeedData", "content-seed.json");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new FileNotFoundException("content-seed.json not found");
    }
}
