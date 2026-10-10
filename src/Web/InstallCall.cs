using System.Globalization;
using System.Text;

namespace HudScale
{
    // Game-free decisions of the mod. This part: the JavaScript call that carries the config values to
    // the page script, and the commands that send it once.
    public static partial class HudScaleLogic
    {
        // The call for page.js with the full state of both HUD settings, the value of Sharp UI, and the
        // panel labels. It is sent also at the game's values, because the settings window needs the
        // sliders. page.js leaves a HUD page alone at the game's values.
        public static string BuildCall(SettingState zoom, SettingState text, bool sharp, PanelLabels labels)
        {
            return "window.__hudscale.install({zoom:" + State(zoom) + ",text:" + State(text)
                + ",sharp:" + (sharp ? "true" : "false")
                + ",labels:{title:" + Str(labels.Title) + ",zoom:" + Str(labels.Zoom) + ",text:" + Str(labels.Text)
                + ",sharp:" + Str(labels.Sharp) + "}})";
        }

        // The result of a command when the root page has no page script: a new root page, or one that
        // the game built again after a browser crash.
        public const string NoScript = "no script";

        // The trigger name of the root-ready message (type 1).
        public const string RootTrigger = "root";

        // The install call when the root page has the page script, else NoScript.
        public static string InstallCommand(string call)
        {
            return "window.__hudscale?" + call + ":'" + NoScript + "'";
        }

        // The page script, then the install call.
        public static string FullCommand(string script, string call)
        {
            return script + ";" + call + ";";
        }

        // A root-ready message always means a new root page, which has no page script. The full script
        // goes with the call at once, so a HUD page never shows unscaled while a short command makes a
        // round trip. Each other trigger sends the short command first.
        public static bool SendsFullScript(string trigger)
        {
            return trigger == RootTrigger;
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
        public readonly string Title, Zoom, Text, Sharp;

        public PanelLabels(string title, string zoom, string text, string sharp)
        {
            Title = title; Zoom = zoom; Text = text; Sharp = sharp;
        }
    }
}
