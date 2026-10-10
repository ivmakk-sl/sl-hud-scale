using System;
using GameCore.HotUpdate.ReduxUI;
using HarmonyLib;

namespace HudScale
{
    // OnMessageFromJS gets each raw message of the root page. The root-ready message (type 1) comes
    // before the panels load, so page.js can wrap notifyPageReady and scale each HUD page before it is
    // visible. The ready message of a HUD page (type 2) installs again, for a page that was ready
    // before the first install arrived. The Postfix leaves the game's own handling as it is.
    [HarmonyPatch(typeof(WebUILayer), "OnMessageFromJS")]
    internal static class InstallOnReadyMessage
    {
        private static void Postfix(Vuplex.WebView.EventArgs<string> eventArgs)
        {
            try
            {
                string message = eventArgs?.Value;
                if (!HudScaleLogic.ShouldInstall(message)) return;
                string trigger = message.Split('\u001E')[1];
                // A hand edit of the file applies when a HUD page loads, for example at a save load.
                if (trigger == "CoreUI1" || trigger == "CoreUI0") Plugin.ReloadIfChanged();
                PageScript.Run(Plugin.BuildCall(), trigger.Length == 0 ? HudScaleLogic.RootTrigger : trigger);
            }
            catch (Exception e) { Plugin.Log.LogWarning($"HUD Scale: install failed: {e}"); }
        }
    }
}
