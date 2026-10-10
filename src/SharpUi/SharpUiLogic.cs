using System;

namespace HudScale
{
    // Game-free decisions of Sharp UI.
    public static class SharpUiLogic
    {
        // The game's lowest pixel density.
        private const float MinDensity = 0.75f;

        // The pixel density that fits the screen: the formula of WebUILayer.ComputeTargetPixelDensity with no
        // cap of the Graphics setting and no Low factor. The game rounds to a quarter step, a half to the even
        // step. Null for a layout width of 0 or less, where the game uses 1: the mod then leaves the value to
        // the game.
        public static float? Fit(float screenWidth, float layoutWidth)
        {
            if (layoutWidth <= 0f) return null;
            float steps = (float)Math.Round(4f * screenWidth / layoutWidth, MidpointRounding.ToEven);
            return Math.Max(MinDensity, steps / 4f);
        }
    }
}
