using System;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using HarmonyLib;

namespace HudScale
{
    [BepInPlugin(PluginGuid, "HUD Scale", "1.2.0")]
    [BepInProcess("SurvivalLog.exe")]
    public sealed class Plugin : BasePlugin
    {
        public const string PluginGuid = "com.ivmakk.survivallog.hudscale";

        internal static new ManualLogSource Log;
        internal static Harmony Harmony;
        internal static ConfigEntry<bool> Verbose;
        internal static ConfigEntry<float> HudZoom;
        internal static ConfigEntry<float> HudTextScale;
        internal static ConfigEntry<bool> SharpUI;

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
                    "Multiply HUD font sizes. Icons and boxes keep their size. The default, 1.0, preserves the original font sizes. This includes text in the top timer box and unlock notifications. It excludes the weather tooltip's description line, other windows, and world labels. The HUD panel of the settings window (Esc, then Settings) also changes this value. A change of this file applies when the settings window opens or a save loads.",
                    new AcceptableValueRange<float>(0.5f, 2.0f)));
            SharpUI = Config.Bind(
                "Display", "SharpUI", true,
                "Sharp UI: draw the whole game interface (the HUD, the windows, the title screen) at the full resolution of the screen, so text and lines are sharp. The game limits this resolution by the graphics setting (on High, sharp up to a screen 3072 pixels wide), so on a wider screen, for example a 4K screen, it draws the interface at a lower resolution and scales it up. With true, the mod uses the resolution that fits the screen on each graphics setting. Set false to give the game its own value back, for example for a weak graphics card. The Sharp UI switch in the HUD panel of the settings window (Esc, then Settings) also changes this value, at once.");
            Settings = Config;
            FileCheck = new ConfigFileCheck(Config.ConfigFilePath);
            // After the binds, so a bind that reads a value from the file does not start an install
            // before the web view exists. The record stops a reload of the file as it is now.
            Config.SettingChanged += OnSettingChanged;
            FileCheck.Record();
            Harmony = new Harmony(PluginGuid);
            Patch(typeof(InstallOnReadyMessage));
            Patch(typeof(SettingsPanelMessages));
            Patch(typeof(SharpUiApply));
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
        // for each entry. The two HUD settings and Sharp UI change the page: Sharp UI for its switch,
        // while SharpUiApply sets the pixel density at the next frame.
        private static void OnSettingChanged(object sender, SettingChangedEventArgs args)
        {
            try
            {
                FileCheck.Record();
                if (SettingBatch) return;
                if (args.ChangedSetting != HudZoom && args.ChangedSetting != HudTextScale && args.ChangedSetting != SharpUI) return;
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

        // The install call with the current values, the limits and the default of each config entry, the
        // value of Sharp UI, and the panel labels in the display language.
        internal static string BuildCall()
        {
            var texts = ModTexts.Current();
            return HudScaleLogic.BuildCall(
                StateOf(HudZoom, HudScaleLogic.GameHudZoom),
                StateOf(HudTextScale, HudScaleLogic.GameTextScale),
                SharpUI.Value,
                new PanelLabels(texts["title"], texts["zoom"], texts["text"], texts["sharp"]));
        }

        private static SettingState StateOf(ConfigEntry<float> entry, float gameValue)
        {
            var range = (AcceptableValueRange<float>)entry.Description.AcceptableValues;
            return new SettingState(entry.Value, range.MinValue, range.MaxValue, (float)entry.DefaultValue, gameValue);
        }
    }
}
