using System;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using GameCore.HotUpdate.ReduxUI;
using HarmonyLib;

namespace HudScale
{
    [BepInPlugin(PluginGuid, "HUD Scale", "1.0.0")]
    [BepInProcess("SurvivalLog.exe")]
    public sealed class Plugin : BasePlugin
    {
        public const string PluginGuid = "com.ivmakk.survivallog.hudscale";

        internal static new ManualLogSource Log;
        internal static Harmony Harmony;
        internal static ConfigEntry<bool> Verbose;
        internal static ConfigEntry<float> HudZoom;
        internal static ConfigEntry<float> HudTextScale;

        public override void Load()
        {
            Log = base.Log;
            Verbose = Config.Bind(
                "General", "Verbose", false,
                "Log each installation of the HUD script and its result at Debug level. Leave false during normal play. To include these entries in LogOutput.log, add Debug to LogLevels under [Logging.Disk] in BepInEx/config/BepInEx.cfg.");
            HudZoom = Config.Bind(
                "HUD", "HudZoom", HudScaleLogic.DefaultHudZoom,
                new ConfigDescription(
                    "Scale the main HUD's text, icons, and boxes together. The game uses 1.3. The mod's default, 1.0, makes the main HUD about 23% smaller. Set 1.3 to keep the game's size. This setting does not scale the top timer box, other windows, or world labels. Restart the game to apply changes.",
                    new AcceptableValueRange<float>(0.5f, 3.0f)));
            HudTextScale = Config.Bind(
                "HUD", "HudTextScale", HudScaleLogic.DefaultTextScale,
                new ConfigDescription(
                    "Multiply HUD font sizes, including text and icons that use font sizes. The boxes keep their size. The default, 1.0, preserves the original font sizes. This includes text in the top timer box and unlock notifications. It excludes the weather tooltip's description line, icons with fixed image dimensions, other windows, and world labels. Restart the game to apply changes.",
                    new AcceptableValueRange<float>(0.5f, 2.0f)));
            Harmony = new Harmony(PluginGuid);
            try { Harmony.CreateClassProcessor(typeof(InstallOnReadyMessage)).Patch(); }
            catch (Exception e) { Log.LogWarning($"patch {nameof(InstallOnReadyMessage)} failed, its target method is missing: {e.Message}"); }
            Log.LogInfo("HUD Scale loaded.");
        }
    }

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
                string call = HudScaleLogic.BuildCall(Plugin.HudZoom.Value, Plugin.HudTextScale.Value);
                if (call == null) return;
                string trigger = message.Split('\u001E')[1];
                PageScript.Run(call, trigger.Length == 0 ? "root" : trigger);
            }
            catch (Exception e) { Plugin.Log.LogWarning($"HUD Scale: install failed: {e}"); }
        }
    }

    // Runs page.js (an embedded resource) plus one call in the root page.
    internal static class PageScript
    {
        private static string script;
        private static readonly HashSet<string> loggedWarnings = new HashSet<string>();

        private static string Script()
        {
            if (script != null) return script;
            var assembly = typeof(PageScript).Assembly;
            string name = Array.Find(assembly.GetManifestResourceNames(), n => n.EndsWith("page.js", StringComparison.Ordinal));
            using (var stream = assembly.GetManifestResourceStream(name))
            using (var reader = new System.IO.StreamReader(stream))
                script = reader.ReadToEnd();
            return script;
        }

        public static void Run(string call, string trigger)
        {
            var webView = ReduxUISystem.Instance?.GetWebUILayer()?.canvasWebViewPrefab?.WebView;
            if (webView == null)
            {
                Plugin.Log.LogWarning("HUD Scale: web view not found");
                return;
            }
            webView.ExecuteJavaScript(Script() + ";" + call + ";", (Il2CppSystem.Action<string>)(r =>
            {
                if (Plugin.Verbose.Value) Plugin.Log.LogDebug($"HUD Scale install ({trigger}): {call} -> {r}");
                // Each distinct problem logs one time, so a game update is not silent but the log is not spammed.
                if (r != "installed" && loggedWarnings.Add(r)) Plugin.Log.LogWarning($"HUD Scale page script: {r}");
            }));
        }
    }
}
