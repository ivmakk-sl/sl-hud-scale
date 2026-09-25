# Configuration

## In the game

1. Load a save.
2. Press Esc.
3. Open **Settings**.
4. Adjust **Scale** or **Text Scale** in the **HUD** panel below **Action Feedback**.

The HUD previews your changes while you drag. Release the slider to save the value. Closing the settings window also saves an unsaved preview. Click a slider's number to restore the mod's default. The mark under each slider shows that default. The HUD panel is available only after a save loads.

| Slider | Config key | Mod default | Range | What it does |
|---|---|---|---|---|
| **Scale** | `HudZoom` | `1.00` | `0.50` to `3.00` | Scales the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons. The game uses `1.30`. The mod's default makes the main HUD about 23% smaller. |
| **Text Scale** | `HudTextScale` | `1.00` | `0.50` to `2.00` | Multiplies HUD font sizes, including text and icons that use font sizes. The boxes keep their size. Use `0.90` for font sizes 10% smaller. Values above `1.00` can cause text to exceed its boxes. |

The sliders move in steps of `0.05`. Both sliders affect text size in the main HUD. Smaller values can reduce overlap, but some text can still exceed its boxes.

To restore the game's HUD sizes, set **Scale** to `1.30` and **Text Scale** to `1.00`. The HUD panel remains available. Clicking the numbers restores the mod's defaults, which are `1.00` for both sliders.

**Text Scale** also scales text that other mods define with pixel font sizes in HUD stylesheets, including Trapline's grid. It does not affect the weather tooltip's description line or icons with fixed image dimensions. Other windows and labels over furniture and characters in the world keep their size with either slider.

## In the config file

The mod creates `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg` when you first start the game with the mod installed. The sliders save their values in the `[HUD]` section of this file.

You can edit the file while the game runs:

1. Close the settings window to prevent its sliders from overwriting your file edits.
2. Edit the values in a text editor.
3. Save the file.
4. Open the settings window or load a save to apply your changes.

No restart is needed. File edits can use values between slider steps, such as `HudZoom = 1.03`. The number beside the slider shows that value until you move the slider.

BepInEx limits values to the allowed range. For example, `HudZoom = 5` applies as `3.0`. When this changes the current value, BepInEx also saves the corrected value to the file.

## Debug logging

The `[General]` section contains `Verbose`, which accepts `true` or `false` and defaults to `false`. Set it to `true` to log each installation of the HUD script and its result at Debug level. Leave it `false` during normal play.

To include debug entries in `BepInEx\LogOutput.log`, add `Debug` to `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`.
