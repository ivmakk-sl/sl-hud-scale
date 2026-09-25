using HudScale;
using Xunit;

public class HudScaleLogicTests
{
    // Root.html joins the four message fields with U+001E: buildProtocol(typeId, param1, param2, json).
    private static string Msg(string type, string page = "") => type + "\x1E" + page + "\x1E\x1E{}";

    [Fact]
    public void RootReadyStartsAnInstall()
    {
        Assert.True(HudScaleLogic.ShouldInstall(Msg("1")));
    }

    [Theory]
    [InlineData("CoreUI1")]
    [InlineData("CoreUI0")]
    public void HudPageReadyStartsAnInstall(string page)
    {
        Assert.True(HudScaleLogic.ShouldInstall(Msg("2", page)));
    }

    [Fact]
    public void OtherPageReadyDoesNotStartAnInstall()
    {
        Assert.False(HudScaleLogic.ShouldInstall(Msg("2", "Cooking")));
    }

    [Theory]
    [InlineData("3")]
    [InlineData("9")]
    public void OtherMessageTypesDoNotStartAnInstall(string type)
    {
        Assert.False(HudScaleLogic.ShouldInstall(Msg(type, "CoreUI1")));
    }

    [Theory]
    [InlineData("2")]
    [InlineData("")]
    [InlineData(null)]
    public void ShortOrMissingMessageDoesNotStartAnInstall(string message)
    {
        Assert.False(HudScaleLogic.ShouldInstall(message));
    }

    [Fact]
    public void GameValuesGiveNoCall()
    {
        Assert.Null(HudScaleLogic.BuildCall(1.3f, 1.0f));
    }

    [Fact]
    public void ModDefaultsZoomTheHud()
    {
        Assert.Equal("window.__hudscale.install(1,null)", HudScaleLogic.BuildCall(HudScaleLogic.DefaultHudZoom, HudScaleLogic.DefaultTextScale));
    }

    [Theory]
    [InlineData(1.1f, 1.0f, "window.__hudscale.install(1.1,null)")]
    [InlineData(1.3f, 0.9f, "window.__hudscale.install(null,0.9)")]
    [InlineData(1.1f, 0.9f, "window.__hudscale.install(1.1,0.9)")]
    public void ChangedValuesGiveTheInstallCall(float zoom, float textScale, string expected)
    {
        Assert.Equal(expected, HudScaleLogic.BuildCall(zoom, textScale));
    }

    [Fact]
    public void NumbersUseADecimalPointInADecimalCommaCulture()
    {
        var previous = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
        try
        {
            Assert.Equal("window.__hudscale.install(1.1,0.9)", HudScaleLogic.BuildCall(1.1f, 0.9f));
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = previous;
        }
    }
}
