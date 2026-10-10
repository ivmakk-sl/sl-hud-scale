# Configuration

## In the game

1. Load a save.
2. Press Esc.
3. Open **Settings**.
4. Adjust **Scale** or **Text Scale**, or turn **Sharp UI** on or off, in the **HUD** panel, the last panel of the **General** tab (after **Interface**).

The HUD previews your changes while you drag. Release the slider to save the value. Closing the settings window also saves an unsaved preview. Click a slider's number to restore the mod's default. The mark under each slider shows that default. The HUD panel is available only after a save loads.

| Slider | Config key | Mod default | Range | What it does |
|---|---|---|---|---|
| **Scale** | `HudZoom` | `1.00` | `0.50` to `3.00` | Scales the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons. The game uses `1.30`. The mod's default makes the main HUD about 23% smaller. |
| **Text Scale** | `HudTextScale` | `1.00` | `0.50` to `2.00` | Multiplies HUD font sizes. Icons and boxes keep their size. Use `0.90` for font sizes 10% smaller. Values above `1.00` can cause text to exceed its boxes. |

The sliders move in steps of `0.05`. Both sliders affect text size in the main HUD. Smaller values can reduce overlap, but some text can still exceed its boxes.

To restore the game's HUD sizes, set **Scale** to `1.30` and **Text Scale** to `1.00`. The HUD panel remains available. Clicking the numbers restores the mod's defaults, which are `1.00` for both sliders.

**Text Scale** also scales text that other mods define with pixel font sizes in HUD stylesheets, including Trapline's grid. It does not affect the weather tooltip's description line. Other windows and labels over furniture and characters in the world keep their size with either slider.

## Sharp UI

| Switch | Config key | Mod default | What it does |
|---|---|---|---|
| **Sharp UI** | `SharpUI` in the `[Display]` section | `true` | Draws the whole game interface (the HUD, the windows, and the title screen) at the full resolution of your screen, so text and lines are sharp. |

The game draws its interface at a lower resolution when the screen is wide, and scales it up, so text and lines look soft. The graphics setting limits this resolution: on **High**, the interface is sharp up to a screen 3072 pixels wide, and less on **Medium** and **Low**. A 4K screen (3840 pixels wide) is past the limit on each graphics setting. With **Sharp UI** on, the mod uses the resolution that fits your screen on each graphics setting, also after you change the graphics setting or the resolution. On a screen within the limit, the interface looks the same as without the mod.

The higher resolution costs a little more graphics memory and work for the interface. If the game runs slower on a weak graphics card, turn **Sharp UI** off: the game then uses its own value at once. The switch applies at once and saves its value. No restart is needed.

## In the config file

The mod creates `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg` when you first start the game with the mod installed. The sliders save their values in the `[HUD]` section of this file, and the **Sharp UI** switch saves its value in the `[Display]` section.

You can edit the file while the game runs:

1. Close the settings window to prevent its sliders and its switch from overwriting your file edits.
2. Edit the values in a text editor.
3. Save the file.
4. Open the settings window or load a save to apply your changes.

No restart is needed. File edits can use values between slider steps, such as `HudZoom = 1.03`. The number beside the slider shows that value until you move the slider.

BepInEx limits values to the allowed range. For example, `HudZoom = 5` applies as `3.0`. When this changes the current value, BepInEx also saves the corrected value to the file.

## Debug logging

The `[General]` section contains `Verbose`, which accepts `true` or `false` and defaults to `false`. Set it to `true` to log each installation of the HUD script and its result at Debug level. Leave it `false` during normal play.

To include debug entries in `BepInEx\LogOutput.log`, add `Debug` to `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`.
