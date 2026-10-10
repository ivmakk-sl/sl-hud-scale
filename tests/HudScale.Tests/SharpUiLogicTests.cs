using HudScale;
using Xunit;

public class SharpUiLogicTests
{
    // The layout width of the web UI on this machine: 1536 (RectTransform width x Resolution).
    [Theory]
    [InlineData(1920f, 1.25f)]
    [InlineData(2560f, 1.75f)]
    [InlineData(3072f, 2.0f)]
    [InlineData(3840f, 2.5f)]
    [InlineData(5120f, 3.25f)]
    public void TheFitIsTheScreenWidthOverTheLayoutWidthInQuarterSteps(float screenWidth, float fit)
    {
        Assert.Equal(fit, SharpUiLogic.Fit(screenWidth, 1536f));
    }

    // 4 x 1728 / 1536 = 4.5 and 4 x 2112 / 1536 = 5.5: the game rounds a half to the even step.
    [Theory]
    [InlineData(1728f, 1.0f)]
    [InlineData(2112f, 1.5f)]
    public void AHalfStepRoundsToTheEvenStep(float screenWidth, float fit)
    {
        Assert.Equal(fit, SharpUiLogic.Fit(screenWidth, 1536f));
    }

    [Fact]
    public void TheFitIsAtLeastThreeQuarters()
    {
        Assert.Equal(0.75f, SharpUiLogic.Fit(800f, 1536f));
    }

    [Theory]
    [InlineData(0f)]
    [InlineData(-1f)]
    public void NoLayoutWidthGivesNoFit(float layoutWidth)
    {
        Assert.Null(SharpUiLogic.Fit(3840f, layoutWidth));
    }
}
