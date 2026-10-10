using System;
using GameCore.HotUpdate.ReduxUI;
using HarmonyLib;

namespace HudScale
{
    // The settings panel sends its own type-3 messages (HUDSCALE_SET on a release, HUDSCALE_SHARP on a
    // turn of the Sharp UI switch, HUDSCALE_SYNC when the settings window opens). The game does not know them, so this Prefix handles each one and
    // stops it. Each other message goes on to the game unchanged.
    [HarmonyPatch(typeof(WebUILayer), "OnMessageFromJS")]
    internal static class SettingsPanelMessages
    {
        private static bool Prefix(Vuplex.WebView.EventArgs<string> eventArgs)
        {
            var kind = MessageKind.None;
            try
            {
                kind = HudScaleLogic.TryParseMessage(eventArgs?.Value, out float zoom, out float textScale, out bool sharp);
                if (kind == MessageKind.None) return true;
                if (Plugin.Verbose.Value) Plugin.Log.LogDebug($"HUD Scale message: {kind} {zoom} {textScale} {sharp}");
                if (kind == MessageKind.Set)
                {
                    Plugin.SetBoth(zoom, textScale);
                }
                else if (kind == MessageKind.Sharp)
                {
                    // BepInEx saves the file, and OnSettingChanged sends the install call, so the switch
                    // shows the stored value. SharpUiApply applies it at the next frame.
                    Plugin.SharpUI.Value = sharp;
                }
                else if (kind == MessageKind.Sync)
                {
                    Plugin.ReloadIfChanged();
                    PageScript.Run(Plugin.BuildCall(), "sync");
                }
                return false;
            }
            catch (Exception e)
            {
                Plugin.Log.LogWarning($"HUD Scale: settings message failed: {e}");
                // A game message always goes on to the game. A mod message does not, because the game
                // does not know its event.
                return kind == MessageKind.None;
            }
        }
    }
}
