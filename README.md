# HUD Scale

HUD Scale adds HUD scale and text size sliders and a Sharp UI switch to the settings window in *Survival Log*. It works in any game language. By default, it reduces the game's HUD zoom from `1.3` to `1.0`, making the main HUD about 23% smaller.

I made this mod because the HUD feels oversized in English. The layout appears to favor compact Chinese text. English labels overlap, quest lines end in "...", and plant and trap names wrap onto two lines. The smaller HUD greatly reduces overlap in my testing. Some text can still exceed its boxes.

- **Scale** resizes the main HUD's text, icons, and boxes together. This includes the story, events, plant and trap lists, stats, and buttons.
- **Text Scale** provides a secondary adjustment for the HUD text. Icons and boxes keep their size, so you can make the text smaller without smaller icons. Its default, `1.0`, preserves the original font sizes.
- **Sharp UI** draws the whole game interface (the HUD, the windows, and the title screen) at the full resolution of your screen, so text and lines are sharp. The game draws its interface at a lower resolution and scales it up on wide screens, for example a 4K screen: at most 3072 pixels wide on the High graphics setting, and less on Medium and Low. Sharp UI is on by default, on each graphics setting. Turn it off to give the game its own value back, for example for a weak graphics card.

If you also want smaller text, try **Text Scale** at `0.90`. Both sliders affect text size in the main HUD. To restore the game's HUD sizes, set **Scale** to `1.30` and **Text Scale** to `1.00`. The HUD panel remains available in the settings window.

Text that other mods define with pixel font sizes in HUD stylesheets also scales, including Trapline's grid. **Text Scale** does not affect the weather tooltip's description line.

The cooking window, the bag, event pop-ups, and other windows keep their size. Labels over furniture and characters in the world, such as dish names and timers, also keep their size. The mod does not edit the game's original files or change the save format.

## Configuration

1. Load a save.
2. Press Esc.
3. Open **Settings**.
4. Adjust **Scale** or **Text Scale**, or turn **Sharp UI** on or off, in the **HUD** panel, the last panel of the **General** tab (after **Interface**).

The HUD previews your changes while you drag. Release the slider to save the value. Click its number to restore the mod's default. The mark under each slider shows that default. The **Sharp UI** switch applies at once and saves its value. The HUD panel is available only after a save loads.

You can also edit `BepInEx\config\com.ivmakk.survivallog.hudscale.cfg`. Close the settings window before you edit the file. File edits apply when you next open the settings window or load a save. No restart is needed. See [CONFIG.md](CONFIG.md) for the config keys, defaults, and limits.

Nexus page: https://www.nexusmods.com/games/survivallog/mods/16

## Requirements

- Survival Log 1.1.18153 (the Autumn Update) or later.
- The [BepInEx Pack for Survival Log](https://www.nexusmods.com/survivallog/mods/12), the BepInEx 6 (IL2CPP) build for the game.

## Install

1. Install the [BepInEx Pack for Survival Log](https://www.nexusmods.com/survivallog/mods/12) (if no other mods were installed before, start the game once so BepInEx finishes setup, then quit).
2. Extract this mod's zip into the game folder (the folder with the game .exe). The DLL lands in `BepInEx\plugins`. Full path example:
   - Steam: `C:\Program Files (x86)\Steam\steamapps\common\Survival Log\BepInEx\plugins\HudScale.dll`

## Uninstall

Delete `HudScale.dll` from the `BepInEx\plugins` folder. The HUD has its normal size on the next start. The config file stays and does nothing without the DLL.

## Troubleshooting

`General` / `Verbose` in the config file logs each installation of the HUD script and its result at Debug level. The default is `false`. To include these entries in `BepInEx\LogOutput.log`, add `Debug` to `LogLevels` under `[Logging.Disk]` in `BepInEx\config\BepInEx.cfg`. Check the log for the `HUD Scale loaded.` line and any warnings from HUD Scale.

## Build

This is a BepInEx 6 IL2CPP plugin. It compiles against the game's IL2CPP interop assemblies. The build needs an installed copy of the game with BepInEx. Start the game once with BepInEx to generate the assemblies. This repo does not include those assemblies.

The build needs the .NET 8 SDK and Node 22.22.2 or a later Node 22 release. The page script uses TypeScript in `src/Web/page/`. Vite builds it into one file, which the DLL embeds. For [mise](https://mise.jdx.dev) users, `mise.toml` specifies the latest Node 22 release.

Run these commands from the mod root:

1. If you use mise, run `mise trust` once after cloning the repo.
2. Install the npm packages from the lock file with `npm ci`.
3. Build the mod with `dotnet build src/HudScale.csproj -c Release`.

The build runs Vite when a page source file changes. If the npm packages are missing, the build stops with a message that explains how to install them.

`Directory.Build.props` sets `GameDir` to the default Steam install path. For another location, set the `GameDir` environment variable or pass `-p:GameDir=...` to the build command. The output DLL is at `src\bin\Release\HudScale.dll`.

These source files contain logic that does not need the game:

- `src/Hud/HudScaleLogic.cs` decides which web view message installs the page script.
- `src/Panel/PanelLogic.cs` reads the messages of the HUD panel, and `src/Panel/ConfigFileCheck.cs` detects changes to the config file.
- `src/Web/InstallCall.cs` builds the call to the page script and the commands that send the script once.
- `src/SharpUi/SharpUiLogic.cs` calculates the pixel density that fits the screen.
- The i18n files `src/i18n/*.json` hold the panel labels, read by the i18n library copy in `src/Shared/i18n/`.

Run their unit tests with this command. The tests do not need the game.

```
dotnet test tests/HudScale.Tests
```

The page tests use Vitest with jsdom. They run the built script against `CoreUI1.html`, `CoreUI0.html`, and `OutSetting.html` from the installed game. Run them after a game update. Set `SL_GAME_DIR` if the game is outside the default Steam path.

Run the page tests, CSS lint, and type check from the mod root:

```
npm test
npm run lint
npm run typecheck
```

Run `npm run dev` to preview the HUD and the HUD panel with a simulated state in a browser. The preview reloads when a page file changes. Use it to check appearance and layout. Check behavior in the game.

## Package

Add `-p:Package=true` to a Release build to also write the ready-to-install zip at `dist\HudScale-<version>.zip`, laid out as `BepInEx\plugins\HudScale.dll` so a user extracts it at the game root. A plain build skips this step.

```
dotnet build src/HudScale.csproj -c Release -p:Package=true
```

## License

Licensed under the GNU General Public License v3.0. Copyright (C) 2026 ivmakk. See [LICENSE](LICENSE).

You may reuse and modify this mod, but you must keep it open under the same license and give credit. Do not reupload it without credit.
