using System;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using GameCore.HotUpdate;
using GameCore.HotUpdate.ReduxUI;
using HarmonyLib;

namespace HudScale
{
    [BepInPlugin(PluginGuid, "HUD Scale", "1.1.0")]
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
                    "Scale the main HUD's text, icons, and boxes together. The game uses 1.3. The mod's default, 1.0, makes the main HUD about 23% smaller. Set 1.3 to keep the game's size. This setting does not scale the top timer box, other windows, or world labels. The HUD panel of the settings window (Esc, then Settings) also changes this value. A change of this file applies when the settings window opens or a save loads.",
                    new AcceptableValueRange<float>(0.5f, 3.0f)));
            HudTextScale = Config.Bind(
                "HUD", "HudTextScale", HudScaleLogic.DefaultTextScale,
                new ConfigDescription(
                    "Multiply HUD font sizes, including text and icons that use font sizes. The boxes keep their size. The default, 1.0, preserves the original font sizes. This includes text in the top timer box and unlock notifications. It excludes the weather tooltip's description line, icons with fixed image dimensions, other windows, and world labels. The HUD panel of the settings window (Esc, then Settings) also changes this value. A change of this file applies when the settings window opens or a save loads.",
                    new AcceptableValueRange<float>(0.5f, 2.0f)));
            Settings = Config;
            FileCheck = new ConfigFileCheck(Config.ConfigFilePath);
            // After the binds, so a bind that reads a value from the file does not start an install
            // before the web view exists. The record stops a reload of the file as it is now.
            Config.SettingChanged += OnSettingChanged;
            FileCheck.Record();
            Harmony = new Harmony(PluginGuid);
            Patch(typeof(InstallOnReadyMessage));
            Patch(typeof(SettingsPanelMessages));
            Log.LogInfo("HUD Scale loaded.");
        }

        private static void Patch(Type patch)
        {
            try { Harmony.CreateClassProcessor(patch).Patch(); }
            catch (Exception e) { Log.LogWarning($"patch {patch.Name} failed, its target method is missing: {e.Message}"); }
        }

        internal static ConfigFile Settings;
        internal static ConfigFileCheck FileCheck;

        // True while the panel sets both values of a release, so the page gets one install with both
        // new values instead of one install for each value.
        private static bool SettingBatch;

        internal static void SetBoth(float zoom, float textScale)
        {
            SettingBatch = true;
            try
            {
                // BepInEx clamps each value and saves the file when a value changes.
                HudZoom.Value = zoom;
                HudTextScale.Value = textScale;
            }
            finally { SettingBatch = false; }
            PageScript.Run(BuildCall(), "set");
        }

        // Each change of a setting comes here: a slider of the settings panel, a reload of the file, or
        // another config tool. BepInEx saved the file before this event, so the write time is recorded
        // for each entry. Only the two HUD settings change the page.
        private static void OnSettingChanged(object sender, SettingChangedEventArgs args)
        {
            try
            {
                FileCheck.Record();
                if (SettingBatch) return;
                if (args.ChangedSetting != HudZoom && args.ChangedSetting != HudTextScale) return;
                PageScript.Run(BuildCall(), "setting " + args.ChangedSetting.Definition.Key);
            }
            catch (Exception e) { Log.LogWarning($"HUD Scale: setting change failed: {e}"); }
        }

        // Reads the config file again when it was written since the last record, for example by a hand
        // edit. A changed value fires OnSettingChanged, which applies it.
        internal static void ReloadIfChanged()
        {
            if (!FileCheck.Changed()) return;
            if (Verbose.Value) Log.LogDebug("HUD Scale: the config file changed, reading it again");
            // The record comes only after a good read, so a file that an editor is still writing is read
            // again at the next check.
            try
            {
                Settings.Reload();
                FileCheck.Record();
            }
            catch (Exception e) { Log.LogWarning($"HUD Scale: could not read the config file: {e.Message}"); }
        }

        // The install call with the current values, and the limits and the default of each config entry.
        internal static string BuildCall()
        {
            return HudScaleLogic.BuildCall(
                StateOf(HudZoom, HudScaleLogic.GameHudZoom),
                StateOf(HudTextScale, HudScaleLogic.GameTextScale),
                HudScaleLogic.Labels(LanguageType()));
        }

        // The display language of the game. The root-ready install comes before the game config loads,
        // so a missing config gives English (1) instead of an exception.
        private static int LanguageType()
        {
            try
            {
                var config = ConfigManager.Instance;
                return config?.customCache != null ? (int)config.customCache.LanguageType : 1;
            }
            catch (Exception) { return 1; }
        }

        private static SettingState StateOf(ConfigEntry<float> entry, float gameValue)
        {
            var range = (AcceptableValueRange<float>)entry.Description.AcceptableValues;
            return new SettingState(entry.Value, range.MinValue, range.MaxValue, (float)entry.DefaultValue, gameValue);
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
                string trigger = message.Split('\u001E')[1];
                // A hand edit of the file applies when a HUD page loads, for example at a save load.
                if (trigger == "CoreUI1" || trigger == "CoreUI0") Plugin.ReloadIfChanged();
                PageScript.Run(Plugin.BuildCall(), trigger.Length == 0 ? "root" : trigger);
            }
            catch (Exception e) { Plugin.Log.LogWarning($"HUD Scale: install failed: {e}"); }
        }
    }

    // The settings panel sends its own type-3 messages (HUDSCALE_SET on a release, HUDSCALE_SYNC when
    // the settings window opens). The game does not know them, so this Prefix handles each one and
    // stops it. Each other message goes on to the game unchanged.
    [HarmonyPatch(typeof(WebUILayer), "OnMessageFromJS")]
    internal static class SettingsPanelMessages
    {
        private static bool Prefix(Vuplex.WebView.EventArgs<string> eventArgs)
        {
            var kind = MessageKind.None;
            try
            {
                kind = HudScaleLogic.TryParseMessage(eventArgs?.Value, out float zoom, out float textScale);
                if (kind == MessageKind.None) return true;
                if (Plugin.Verbose.Value) Plugin.Log.LogDebug($"HUD Scale message: {kind} {zoom} {textScale}");
                if (kind == MessageKind.Set)
                {
                    Plugin.SetBoth(zoom, textScale);
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
