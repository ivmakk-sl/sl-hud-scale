# Configuration

Every setting lives in `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg`, written the first time you run the game with the mod installed. The HUD panel of the settings window changes the HUD and Display settings in the game. You can also edit the file with any text editor while the game runs. No restart is needed.

To change a setting in the game:

1. Load a save.
2. Press Esc.
3. Open **Settings**.
4. Adjust **Scale** or **Text Scale**, or turn **Sharp UI** on or off, in the **HUD** panel, the last panel of the **General** tab (after **Interface**).

The HUD panel is available only after a save loads. The panel saves each value to the file.

To change a setting in the file:

1. Close the settings window to prevent its sliders and its switch from overwriting your file edits.
2. Edit the values in a text editor.
3. Save the file.
4. Open the settings window or load a save to apply your changes.

BepInEx limits values to the allowed range. For example, `HudZoom = 5` applies as `3.0`. When this changes the current value, BepInEx also saves the corrected value to the file.

## General

| Setting | Default | Values | What it does |
|---|---|---|---|
| `Verbose` | `false` | `true` / `false` | Logs each installation of the HUD script and its result at Debug level. Leave `false` in normal play. |

To record these messages in `BepInEx\LogOutput.log`, also include `Debug` in `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`.

## HUD

| Setting | Default | Values | What it does |
|---|---|---|---|
| `HudZoom` | `1.0` | `0.5` to `3.0` | The **Scale** slider. Scales the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons. The game uses `1.3`. The mod's default makes the main HUD about 23% smaller. |
| `HudTextScale` | `1.0` | `0.5` to `2.0` | The **Text Scale** slider. Multiplies HUD font sizes. Icons and boxes keep their size. Use `0.9` for font sizes 10% smaller. Values above `1.0` can cause text to exceed its boxes. |

The HUD previews your changes while you drag a slider. Release the slider to save the value. Closing the settings window also saves an unsaved preview. Click a slider's number to restore the mod's default. The mark under each slider shows that default.

The sliders move in steps of `0.05`. File edits can use values between slider steps, such as `HudZoom = 1.03`. The number beside the slider shows that value until you move the slider.

Both settings affect text size in the main HUD. Smaller values can reduce overlap, but some text can still exceed its boxes. To restore the game's HUD sizes, set `HudZoom` to `1.3` and `HudTextScale` to `1.0`.

`HudTextScale` also scales text that other mods define with pixel font sizes in HUD stylesheets, including Trapline's grid. It does not affect the weather tooltip's description line. Other windows and labels over furniture and characters in the world keep their size with either setting.

## Display

| Setting | Default | Values | What it does |
|---|---|---|---|
| `SharpUI` | `true` | `true` / `false` | The **Sharp UI** switch. Draws the game interface (the HUD, the windows, and the title screen) at a resolution close to your screen resolution, so text and lines look clearer. `false` gives the game's normal interface resolution back. |

The game draws its interface at a lower resolution when the screen is wide, and scales it up, so text and lines look soft. The graphics setting limits this resolution: on **High**, the interface is sharp up to a screen about 3072 pixels wide, and less on **Medium** and **Low**. A 4K screen (3840 pixels wide) is past the limit on each graphics setting. On **Low**, the game also lowers the interface resolution on each screen.

With **Sharp UI** on, the mod removes these limits, also after you change the graphics setting or the resolution. The game sets the interface resolution in steps, and the mod uses the step closest to your screen resolution. So the result is close to your screen resolution, but not always exactly the same. When **Sharp UI** makes a visible difference:

- On **High** and **Medium**: only on a screen past the limit, for example a 4K screen. On a smaller screen, the interface looks the same as without the mod.
- On **Low**: on most screens, because the mod also removes the lower resolution of **Low**. At some lower resolutions, it makes no visible difference.

**Sharp UI** uses more graphics memory and can slow the game, mostly on a wide screen or a weak graphics card. For example, on a 4K screen on **Low**, the interface has almost three times as many pixels as without the mod. If the game runs slower, turn **Sharp UI** off: the game then uses its normal interface resolution at once. The switch applies at once and saves its value.
