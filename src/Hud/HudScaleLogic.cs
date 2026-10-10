namespace HudScale
{
    // Game-free decisions of the mod. This part: which raw web view message starts an install of the
    // page script, and the values of the two HUD settings. The panel messages are in Panel/PanelLogic.cs,
    // the install call in Web/InstallCall.cs.
    public static partial class HudScaleLogic
    {
        // Root.html joins the four fields of a message with U+001E: [0] the type id, [1] the page id.
        private const char FieldSeparator = '\u001E';

        // The page id of the pause window with the settings window, which gets the HUD panel.
        private const string SettingsPage = "OutSetting";

        // Type 1: the root page is ready (sent before the panels load, and again after a recovery).
        // Type 2: a page is ready, with its page id.
        public static bool ShouldInstall(string message)
        {
            if (message == null) return false;
            string[] fields = message.Split(FieldSeparator);
            if (fields.Length < 2) return false;
            if (fields[0] == "1") return true;
            return fields[0] == "2" && (fields[1] == "CoreUI1" || fields[1] == "CoreUI0" || fields[1] == SettingsPage);
        }

        // The game's own values: the "body { zoom: 1.3 }" of CoreUI1 and the unscaled font sizes.
        public const float GameHudZoom = 1.3f;
        public const float GameTextScale = 1.0f;

        // The config defaults. The mod zooms the HUD out from the game's 1.3 by default.
        public const float DefaultHudZoom = 1.0f;
        public const float DefaultTextScale = 1.0f;
    }
}
