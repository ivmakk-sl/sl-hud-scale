using System;
using System.Globalization;

namespace HudScale
{
    // Game-free decisions of the mod. This part: the messages of the HUD panel of the settings window.
    public static partial class HudScaleLogic
    {
        // The settings panel posts type-3 messages with an event name that starts with this prefix. The
        // game does not know these events, so the mod handles and stops each one.
        private const string ModEventPrefix = "HUDSCALE_";

        // Reads a message of the settings panel. None: not a mod message, which includes a mod event
        // from a page other than the settings page. Set: both values, zoom first,
        // as "1.05,0.9". Sharp: the Sharp UI switch, as "1" or "0". Sync: the settings window opened.
        // Invalid: a mod message that is not usable.
        public static MessageKind TryParseMessage(string message, out float zoom, out float textScale, out bool sharp)
        {
            zoom = 0f;
            textScale = 0f;
            sharp = false;
            if (message == null) return MessageKind.None;
            string[] fields = message.Split(FieldSeparator);
            if (fields.Length < 3 || fields[0] != "3" || fields[1] != SettingsPage || !fields[2].StartsWith(ModEventPrefix, StringComparison.Ordinal)) return MessageKind.None;
            if (fields.Length < 4) return MessageKind.Invalid;
            if (fields[2] == "HUDSCALE_SYNC") return MessageKind.Sync;
            if (fields[2] == "HUDSCALE_SHARP")
            {
                if (fields[3] != "1" && fields[3] != "0") return MessageKind.Invalid;
                sharp = fields[3] == "1";
                return MessageKind.Sharp;
            }
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
    }

    public enum MessageKind { None, Set, Sync, Sharp, Invalid }
}
