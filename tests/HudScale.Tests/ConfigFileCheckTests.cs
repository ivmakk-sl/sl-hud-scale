using HudScale;
using Xunit;

public sealed class ConfigFileCheckTests : IDisposable
{
    private readonly string path = Path.Combine(Path.GetTempPath(), "hudscale-" + Guid.NewGuid().ToString("N") + ".cfg");

    public ConfigFileCheckTests()
    {
        File.WriteAllText(path, "HudZoom = 1");
        File.SetLastWriteTimeUtc(path, new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc));
    }

    public void Dispose()
    {
        if (File.Exists(path)) File.Delete(path);
    }

    [Fact]
    public void ANewCheckSeesAChange()
    {
        Assert.True(new ConfigFileCheck(path).Changed());
    }

    [Fact]
    public void NoChangeAfterRecord()
    {
        var check = new ConfigFileCheck(path);
        check.Record();
        Assert.False(check.Changed());
    }

    [Fact]
    public void ALaterWriteIsAChangeUntilTheNextRecord()
    {
        var check = new ConfigFileCheck(path);
        check.Record();
        File.WriteAllText(path, "HudZoom = 1.1");
        File.SetLastWriteTimeUtc(path, new DateTime(2026, 9, 25, 12, 0, 5, DateTimeKind.Utc));
        Assert.True(check.Changed());
        check.Record();
        Assert.False(check.Changed());
    }

    [Fact]
    public void AMissingFileIsNoChange()
    {
        var check = new ConfigFileCheck(path + ".missing");
        Assert.False(check.Changed());
        check.Record();
        Assert.False(check.Changed());
    }
}
