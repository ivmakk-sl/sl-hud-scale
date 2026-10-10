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
    public void SettingsPageReadyStartsAnInstall()
    {
        Assert.True(HudScaleLogic.ShouldInstall(Msg("2", "OutSetting")));
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

    private static readonly SettingState Zoom = new SettingState(1.0f, 0.5f, 3.0f, 1.0f, 1.3f);
    private static readonly SettingState Text = new SettingState(1.0f, 0.5f, 2.0f, 1.0f, 1.0f);
    private static readonly PanelLabels English = new PanelLabels("HUD", "Scale", "Text Scale", "Sharp UI");

    [Fact]
    public void CallCarriesTheStateOfEachSettingAndTheLabels()
    {
        Assert.Equal(
            "window.__hudscale.install({zoom:{value:1,min:0.5,max:3,def:1,game:1.3},text:{value:1,min:0.5,max:2,def:1,game:1},sharp:true,labels:{title:\"HUD\",zoom:\"Scale\",text:\"Text Scale\",sharp:\"Sharp UI\"}})",
            HudScaleLogic.BuildCall(Zoom, Text, true, English));
    }

    [Fact]
    public void CallCarriesSharpUiOff()
    {
        Assert.Contains(",sharp:false,", HudScaleLogic.BuildCall(Zoom, Text, false, English));
    }

    [Fact]
    public void GameValuesStillGiveACall()
    {
        var gameZoom = new SettingState(1.3f, 0.5f, 3.0f, 1.0f, 1.3f);
        Assert.StartsWith(
            "window.__hudscale.install({zoom:{value:1.3,",
            HudScaleLogic.BuildCall(gameZoom, Text, true, English));
    }

    [Fact]
    public void InstallCommandRunsTheCallOnlyWhenTheRootPageHasTheScript()
    {
        Assert.Equal(
            "window.__hudscale?window.__hudscale.install({}):'no script'",
            HudScaleLogic.InstallCommand("window.__hudscale.install({})"));
        Assert.Equal("no script", HudScaleLogic.NoScript);
    }

    [Fact]
    public void FullCommandIsTheScriptThenTheCall()
    {
        Assert.Equal("S;window.__hudscale.install({});", HudScaleLogic.FullCommand("S", "window.__hudscale.install({})"));
    }

    [Fact]
    public void OnlyTheRootReadyTriggerSendsTheFullScriptAtOnce()
    {
        Assert.True(HudScaleLogic.SendsFullScript(HudScaleLogic.RootTrigger));
        foreach (string trigger in new[] { "CoreUI1", "CoreUI0", "OutSetting", "sync", "set", "setting HudZoom" })
            Assert.False(HudScaleLogic.SendsFullScript(trigger));
    }

    [Fact]
    public void ChineseLabelsAreEscapedToPlainAscii()
    {
        string call = HudScaleLogic.BuildCall(Zoom, Text, true, new PanelLabels("主界面", "缩放", "文字缩放", "高清界面"));
        Assert.All(call, c => Assert.InRange(c, (char)0x20, (char)0x7E));
        Assert.Contains("labels:{title:\"\\u4E3B\\u754C\\u9762\",zoom:\"\\u7F29\\u653E\",text:\"\\u6587\\u5B57\\u7F29\\u653E\",sharp:\"\\u9AD8\\u6E05\\u754C\\u9762\"}", call);
    }

    // The settings panel posts its own type-3 messages: 3, OutSetting, the event name, the data.
    private static string ModMsg(string name, string data) => "3\x1EOutSetting\x1E" + name + "\x1E" + data;

    [Fact]
    public void SetMessageGivesBothValues()
    {
        Assert.Equal(MessageKind.Set, HudScaleLogic.TryParseMessage(ModMsg("HUDSCALE_SET", "1.05,0.9"), out float zoom, out float text, out _));
        Assert.Equal((1.05f, 0.9f), (zoom, text));
    }

    [Fact]
    public void SetMessageUsesADecimalPointInADecimalCommaCulture()
    {
        var previous = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
        try
        {
            Assert.Equal(MessageKind.Set, HudScaleLogic.TryParseMessage(ModMsg("HUDSCALE_SET", "1.05,0.9"), out float zoom, out float text, out _));
            Assert.Equal((1.05f, 0.9f), (zoom, text));
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void SyncMessageIsRecognized()
    {
        Assert.Equal(MessageKind.Sync, HudScaleLogic.TryParseMessage(ModMsg("HUDSCALE_SYNC", ""), out _, out _, out _));
    }

    [Theory]
    [InlineData("1", true)]
    [InlineData("0", false)]
    public void SharpMessageGivesTheValue(string data, bool expected)
    {
        Assert.Equal(MessageKind.Sharp, HudScaleLogic.TryParseMessage(ModMsg("HUDSCALE_SHARP", data), out _, out _, out bool sharp));
        Assert.Equal(expected, sharp);
    }

    [Theory]
    [InlineData("HUDSCALE_SHARP", "true")]
    [InlineData("HUDSCALE_SHARP", "")]
    [InlineData("HUDSCALE_SET", "1.05")]
    [InlineData("HUDSCALE_SET", "big,0.9")]
    [InlineData("HUDSCALE_SET", "NaN,0.9")]
    [InlineData("HUDSCALE_SET", "1.1,Infinity")]
    [InlineData("HUDSCALE_SET", "")]
    [InlineData("HUDSCALE_OTHER", "")]
    public void UnusableModMessageIsInvalid(string name, string data)
    {
        Assert.Equal(MessageKind.Invalid, HudScaleLogic.TryParseMessage(ModMsg(name, data), out _, out _, out _));
    }

    [Fact]
    public void ModMessageWithNoDataFieldIsInvalid()
    {
        Assert.Equal(MessageKind.Invalid, HudScaleLogic.TryParseMessage("3\x1EOutSetting\x1EHUDSCALE_SET", out _, out _, out _));
    }

    [Theory]
    [InlineData("3\x1EOutSetting\x1EOPEN_SETTINGS\x1E{}")]
    [InlineData("1\x1E\x1E\x1E{}")]
    [InlineData("3\u001ECoreUI1\u001EHUDSCALE_SET\u001E1.05,0.9")]
    [InlineData("3\u001ECoreUI1\u001EHUDSCALE_SYNC\u001E")]
    [InlineData("")]
    [InlineData(null)]
    public void OtherMessagesAreNotModMessages(string message)
    {
        Assert.Equal(MessageKind.None, HudScaleLogic.TryParseMessage(message, out _, out _, out _));
    }

    [Fact]
    public void NumbersUseADecimalPointInADecimalCommaCulture()
    {
        var previous = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
        try
        {
            var zoom = new SettingState(1.05f, 0.5f, 3.0f, 1.0f, 1.3f);
            Assert.StartsWith(
                "window.__hudscale.install({zoom:{value:1.05,min:0.5,max:3,def:1,game:1.3}",
                HudScaleLogic.BuildCall(zoom, Text, true, English));
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = previous;
        }
    }
}
