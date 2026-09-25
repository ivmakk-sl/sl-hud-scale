# HUD Scale

HUD Scale lets you reduce the oversized HUD in the English version of *Survival Log*. The layout appears to favor compact Chinese text. English labels overlap, quest lines end in "...", and plant and trap names wrap onto two lines.

The game uses a main HUD zoom of `1.3`. Reducing it to `1.0` makes the HUD about 23% smaller and greatly reduces overlap in my testing. This is the main reason I made the mod. Some text can still exceed its boxes.

- `HudZoom` scales the full main HUD (story, events, plant and trap lists, stats, buttons): text, icons, and boxes together. The game uses `1.3`. The mod's default is `1.0`, which makes the main HUD about 23% smaller.
- `HudTextScale` provides a secondary adjustment for text and icons that use font sizes. The boxes keep their size. The default is `1.0`, which preserves the original font sizes.

The mod sets `HudZoom = 1.0` by default, so the HUD is smaller as soon as you install it. If you also want smaller text, try `HudTextScale = 0.9`. Both settings affect text size in the main HUD. To keep the game's HUD size, set `HudZoom = 1.3`. With `HudZoom = 1.3` and `HudTextScale = 1.0`, the mod changes nothing. The HUD appears at the configured size, with no jump from its original size.

`HudZoom` does not scale the top timer box. `HudTextScale` also applies to text in the top timer box and unlock notifications. The weather tooltip's description line does not respond to `HudTextScale`. Text that other mods define with pixel font sizes in HUD stylesheets also scales, including Trapline's grid.

The cooking window, the bag, event pop-ups, and other windows keep their size. Labels over furniture and characters in the world, such as dish names and timers, also keep their size. The mod does not edit the game's original files or change the save format.

## Configuration

The mod creates `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg` when you first start the game with the mod installed. Edit the settings in a text editor. Restart the game to apply your changes. See [CONFIG.md](CONFIG.md) for each setting, its default, and its limits.

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

The choice of which web view message starts the page script, and the call it gets, is game-free code (`src/HudScaleLogic.cs`) with unit tests. The tests do not need the game:

```
dotnet test tests/HudScale.Tests
```

The page script `src/page.js` has its own test, which runs it against the real `CoreUI1.html` and `CoreUI0.html` of the installed game (Node with jsdom). Run it after a game update. It needs the game install, and `SL_GAME_DIR` overrides the default Steam path:

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
