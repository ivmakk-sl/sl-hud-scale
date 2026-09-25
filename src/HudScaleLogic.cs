using System;
using System.Globalization;
using System.Text;

namespace HudScale
{
    // Game-free decisions of the mod: which raw web view message starts an install of the page
    // script, and the JavaScript call that carries the config values.
    public static class HudScaleLogic
    {
        // Root.html joins the four fields of a message with U+001E: [0] the type id, [1] the page id.
        private const char FieldSeparator = '\u001E';

        // Type 1: the root page is ready (sent before the panels load, and again after a recovery).
        // Type 2: a page is ready, with its page id. OutSetting is the pause window with the settings
        // window, which gets the HUD panel.
        public static bool ShouldInstall(string message)
        {
            if (message == null) return false;
            string[] fields = message.Split(FieldSeparator);
            if (fields.Length < 2) return false;
            if (fields[0] == "1") return true;
            return fields[0] == "2" && (fields[1] == "CoreUI1" || fields[1] == "CoreUI0" || fields[1] == "OutSetting");
        }

        // The game's own values: the "body { zoom: 1.3 }" of CoreUI1 and the unscaled font sizes.
        public const float GameHudZoom = 1.3f;
        public const float GameTextScale = 1.0f;

        // The config defaults. The mod zooms the HUD out from the game's 1.3 by default.
        public const float DefaultHudZoom = 1.0f;
        public const float DefaultTextScale = 1.0f;

        // The settings panel posts type-3 messages with an event name that starts with this prefix. The
        // game does not know these events, so the mod handles and stops each one.
        private const string ModEventPrefix = "HUDSCALE_";

        // Reads a message of the settings panel. None: not a mod message. Set: both values, zoom first,
        // as "1.05,0.9". Sync: the settings window opened. Invalid: a mod message that is not usable.
        public static MessageKind TryParseMessage(string message, out float zoom, out float textScale)
        {
            zoom = 0f;
            textScale = 0f;
            if (message == null) return MessageKind.None;
            string[] fields = message.Split(FieldSeparator);
            if (fields.Length < 3 || fields[0] != "3" || !fields[2].StartsWith(ModEventPrefix, StringComparison.Ordinal)) return MessageKind.None;
            if (fields.Length < 4) return MessageKind.Invalid;
            if (fields[2] == "HUDSCALE_SYNC") return MessageKind.Sync;
            if (fields[2] != "HUDSCALE_SET") return MessageKind.Invalid;
            string[] values = fields[3].Split(',');
            if (values.Length != 2 || !TryParseFinite(values[0], out zoom) || !TryParseFinite(values[1], out textScale)) return MessageKind.Invalid;
            return MessageKind.Set;
        }

        private static bool TryParseFinite(string text, out float value)
        {
            return float.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out value)
                && !float.IsNaN(value) && !float.IsInfinity(value);
        }

        // The call for page.js with the full state of both settings and the panel labels. It is sent
        // also at the game's values, because the settings window needs the sliders. page.js leaves a
        // HUD page alone at the game's values.
        public static string BuildCall(SettingState zoom, SettingState text, PanelLabels labels)
        {
            return "window.__hudscale.install({zoom:" + State(zoom) + ",text:" + State(text)
                + ",labels:{title:" + Str(labels.Title) + ",zoom:" + Str(labels.Zoom) + ",text:" + Str(labels.Text) + "}})";
        }

        // The panel labels in the display language: LanguageType 0 is Chinese, each other value English.
        public static PanelLabels Labels(int languageType)
        {
            return languageType == 0
                ? new PanelLabels("主界面", "缩放", "文字缩放")
                : new PanelLabels("HUD", "Scale", "Text Scale");
        }

        private static string State(SettingState s)
        {
            return "{value:" + Num(s.Value) + ",min:" + Num(s.Min) + ",max:" + Num(s.Max)
                + ",def:" + Num(s.Default) + ",game:" + Num(s.Game) + "}";
        }

        private static string Num(float value)
        {
            return value.ToString(CultureInfo.InvariantCulture);
        }

        // A JavaScript string literal in plain ASCII: each non-ASCII character becomes a \uXXXX escape.
        private static string Str(string value)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in value)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < 0x20 || c > 0x7E) sb.Append("\\u").Append(((int)c).ToString("X4", CultureInfo.InvariantCulture));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }
    }

    public enum MessageKind { None, Set, Sync, Invalid }

    // One setting as the page needs it: the current value, the limits and the default of the config
    // entry, and the game's own value.
    public readonly struct SettingState
    {
        public readonly float Value, Min, Max, Default, Game;

        public SettingState(float value, float min, float max, float @default, float game)
        {
            Value = value; Min = min; Max = max; Default = @default; Game = game;
        }
    }

    public sealed class PanelLabels
    {
        public readonly string Title, Zoom, Text;

        public PanelLabels(string title, string zoom, string text)
        {
            Title = title; Zoom = zoom; Text = text;
        }
    }
}
