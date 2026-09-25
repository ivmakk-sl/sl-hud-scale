# Configuration

The mod creates `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg` when you first start the game with the mod installed. Edit the settings in a text editor. Restart the game to apply your changes.

By default, the mod sets `HudZoom = 1.0` to reduce the game's oversized main HUD. This makes it about 23% smaller than the game's zoom of `1.3`. If you also want smaller text, try `HudTextScale = 0.9`. Smaller settings can reduce overlap, but some text can still exceed its boxes. To keep the game's HUD, set `HudZoom = 1.3` and `HudTextScale = 1.0`. With these values, the mod changes nothing.

## General

| Setting | Default | Values | What it does |
|---|---|---|---|
| `Verbose` | `false` | `true` / `false` | Logs each installation of the HUD script and its result at Debug level. Leave `false` during normal play. |

To include debug entries in `BepInEx\LogOutput.log`, add `Debug` to `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`.

## HUD

| Setting | Default | Values | What it does |
|---|---|---|---|
| `HudZoom` | `1.0` | Number from `0.5` to `3.0` | Scales the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons. The game uses by default `1.3`. The mod's default, `1.0`, makes the main HUD about 23% smaller. Use `1.3` to keep the game's size. |
| `HudTextScale` | `1.0` | Number from `0.5` to `2.0` | Multiplies HUD font sizes, which affects text and icons that use font sizes. The boxes keep their size. The default preserves the original font sizes. Use `0.9` for font sizes 10% smaller. Values above `1.0` can cause text to exceed its boxes. |

BepInEx replaces values outside the allowed range with the nearest limit and saves the corrected values to the config file.

Both settings affect text size in the main HUD. `HudTextScale` also applies to text in the top timer box and unlock notifications. It scales text that other mods define with pixel font sizes in HUD stylesheets, including Trapline's grid.

The weather tooltip's description line does not respond to `HudTextScale`, because the game sets its font size directly on the element. Icons with fixed image dimensions do not respond to `HudTextScale` either. Other windows and labels over furniture and characters in the world keep their size with either setting.
