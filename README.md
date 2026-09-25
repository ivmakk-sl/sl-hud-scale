# HUD Scale

HUD Scale adds HUD scale and text size sliders to the settings window in *Survival Log*. It works in any game language. By default, it reduces the game's HUD zoom from `1.3` to `1.0`, making the main HUD about 23% smaller.

I made this mod because the HUD feels oversized in English. The layout appears to favor compact Chinese text. English labels overlap, quest lines end in "...", and plant and trap names wrap onto two lines. The smaller HUD greatly reduces overlap in my testing. Some text can still exceed its boxes.

- **Scale** resizes the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons.
- **Text Scale** provides a secondary adjustment for text and icons that use font sizes. The boxes keep their size. Its default, `1.0`, preserves the original font sizes.

If you also want smaller text, try **Text Scale** at `0.90`. Both sliders affect text size in the main HUD. To restore the game's HUD sizes, set **Scale** to `1.30` and **Text Scale** to `1.00`. The HUD panel remains available in the settings window.

Text that other mods define with pixel font sizes in HUD stylesheets also scales, including Trapline's grid. **Text Scale** does not affect the weather tooltip's description line or icons with fixed image dimensions.

The cooking window, the bag, event pop-ups, and other windows keep their size. Labels over furniture and characters in the world, such as dish names and timers, also keep their size. The mod does not edit the game's original files or change the save format.

## Configuration

1. Load a save.
2. Press Esc.
3. Open **Settings**.
4. Adjust **Scale** or **Text Scale** in the **HUD** panel below **Action Feedback**.

The HUD previews your changes while you drag. Release the slider to save the value. Click its number to restore the mod's default. The mark under each slider shows that default. The HUD panel is available only after a save loads.

You can also edit `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg`. Close the settings window before you edit the file. File edits apply when you next open the settings window or load a save. No restart is needed. See [CONFIG.md](CONFIG.md) for the config keys, defaults, and limits.

Nexus page: https://www.nexusmods.com/games/survivallog/mods/16

## Requirements

The [BepInEx Pack for Survival Log](https://www.nexusmods.com/survivallog/mods/12), the BepInEx 6 (IL2CPP) build for the game.

## Install

1. Install the [BepInEx Pack for Survival Log](https://www.nexusmods.com/survivallog/mods/12) (if no other mods were installed before, start the game once so BepInEx finishes setup, then quit).
2. Extract this mod's zip into the game folder (the folder with the game .exe). The DLL lands in `BepInEx\plugins`. Full path example:
   - Steam: `C:\Program Files (x86)\Steam\steamapps\common\Survival Log\BepInEx\plugins\HudScale.dll`

## Uninstall

Delete `HudScale.dll` from the `BepInEx\plugins` folder. The HUD has its normal size on the next start. The config file stays and does nothing without the DLL.

## Troubleshooting

`General` / `Verbose` in the config file logs each installation of the HUD script and its result at Debug level. The default is `false`. To include these entries in `BepInEx\LogOutput.log`, add `Debug` to `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`. Check the log for the `HUD Scale loaded.` line and any warnings from HUD Scale.

## Build

This is a BepInEx 6 IL2CPP plugin. It compiles against the game's IL2CPP interop assemblies, so a game install with BepInEx set up and started once is required. Those assemblies are game-derived and are not part of this repo. The .NET 8 SDK is required.

```
dotnet build src/HudScale.csproj -c Release
```

`Directory.Build.props` sets `GameDir` to the default Steam install path. If the game is in another place, override it without an edit of the file: set a `GameDir` environment variable, or pass `-p:GameDir=...` on the build. The output DLL is at `src\bin\Release\HudScale.dll`.

`src/HudScaleLogic.cs` handles web view messages, parses settings panel messages, and builds calls to the page script. `src/ConfigFileCheck.cs` detects changes to the config file. Their unit tests do not need the game:

```
dotnet test tests/HudScale.Tests
```

The page script `src/page.js` has its own test, which runs it against the real `CoreUI1.html`, `CoreUI0.html`, and `OutSetting.html` of the installed game (Node with jsdom). Run it after a game update. It needs the game install, and `SL_GAME_DIR` overrides the default Steam path:

```
cd tests/page
npm install
npm test
```

## Package

Add `-p:Package=true` to a Release build to also write the ready-to-install zip at `dist\HudScale-<version>.zip`, laid out as `BepInEx\plugins\HudScale.dll` so a user extracts it at the game root. A plain build skips this step.

```
dotnet build src/HudScale.csproj -c Release -p:Package=true
```

## License

Licensed under the GNU General Public License v3.0. Copyright (C) 2026 ivmakk. See [LICENSE](LICENSE).

You may reuse and modify this mod, but you must keep it open under the same license and give credit. Do not reupload it without credit.
