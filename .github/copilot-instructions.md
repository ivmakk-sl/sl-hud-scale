# Copilot code-review instructions

This repo is a BepInEx 6 (IL2CPP) Harmony mod for *Survival Log*. Plugins derive from `BasePlugin` and call the game through Il2CppInterop proxy assemblies.

## IL2CPP Harmony traps

- **Getter/setter patches often never fire.** il2cpp inlines trivial accessors. Flag a `MethodType.Getter`/`.Setter` patch used as the only mechanism; mutate the backing field at a load hook instead.
- **No `is`/`as` across the interop boundary.** Flag `is`, `as`, or a direct cast on a game type. Use `x.TryCast<T>()` and a null check.
- **No `foreach` over game collections.** Expect `GetEnumerator()` / `MoveNext()` / `Current`, or a count plus an indexer.
- **Never read an `Il2CppSystem.ValueTuple<...>` result of a game method,** direct or as a list element: the interop layer returns garbage with no error. Expect a method that returns a class, a dictionary, or an `Il2CppStructArray`, or a value the mod calculates.
- **Guard game lookups.** Singletons and config lookups often return null. Flag an unchecked dereference in a patch.
- **A patch must not break the game.** Each patch body sits in a try/catch that logs the error, so the HUD falls back to the game's behavior.

## Structure and tests

- **Feature folders.** `src/Hud/` (the install on ready messages), `src/Panel/` (the messages of the HUD panel and the config-file check), `src/SharpUi/` (Sharp UI), `src/Web/` (the page script send, the install call, and the page code). `Plugin.cs` holds the config, the patch list, and `Load`.
- **Pure logic is separated and tested.** Game-free logic (message routing in `Hud/HudScaleLogic.cs`, the parse of panel messages in `Panel/PanelLogic.cs`, the config-file edit check in `Panel/ConfigFileCheck.cs`, the script call and the send-once commands in `Web/InstallCall.cs`, the pixel density that fits the screen in `SharpUi/SharpUiLogic.cs`) has no BepInEx or Il2Cpp reference and is unit-tested under `tests/HudScale.Tests`. Flag new pure logic in a patch class or with no test.
- **Mod texts are in the i18n files** `src/i18n/en.json` and `zh.json`, read through the i18n library copy `src/Shared/i18n/` (`ModTexts.cs`). Flag a mod text in code. Never edit `src/Shared/` by hand.
- **Patches** prefer a postfix; the `Harmony` instance uses the plugin GUID, and each patch class is attached on its own. Two patches are on `WebUILayer.OnMessageFromJS`: the Postfix installs the page script on ready messages and does not change the game's handling; the Prefix returns `false` only for the mod's own `HUDSCALE_` events of `OutSetting` (`SET`, `SHARP`, `SYNC`); every other message, and any message on an error, returns `true`.
- **Sharp UI** is a postfix of `HotUpdateCaller.Update` (each frame, also at the title screen and in a pause). While `SharpUI` is on, it sets `canvasWebViewPrefab.PixelDensity` to the value that fits the screen only when it differs; at each change from on to off it calls `WebUILayer.RefreshPixelDensity()` once, so the game sets its own value. It must not patch the game's private `ComputeTargetPixelDensity` (a Prefix of a private method that returns a value can give the caller the default value). Flag per-frame work beyond a few reads and one compare, and a log line in the frame path outside `Verbose`.
- **Send once.** C# sends the short call `window.__hudscale ? window.__hudscale.install(state) : 'no script'` and the full script only on `no script`, with one full send in flight and a time limit; only the root-ready message (type 1, a new root page) sends the full script at once. Flag a send of the full script for another trigger.
- **Numbers go to JavaScript with the invariant culture.** Flag a float in the script call without `CultureInfo.InvariantCulture` (a decimal-comma system writes `0,9`).
- **No change at the game's values.** At `HudZoom = 1.3` and `HudTextScale = 1.0` (the game's values, not the config defaults) the page script still runs for the sliders, but leaves each HUD page as the game has it; a page the mod changed before goes back to the game's style. Flag code that touches an unchanged HUD page at these values.
- **Page script.** The TypeScript modules in `src/Web/page/` (built by Vite into one file that the DLL embeds as `HudScale.page.js`) run in the root page and reaches `CoreUI1` and `CoreUI0` through their iframes. It multiplies each px font size and divides each em width and height by the text scale, always from the original value, so em icons keep their size. It writes the body zoom only when the value differs, and changes no other page except the HUD panel in the `OutSetting` settings window. The HUD panel is a `.settings-section` of its own, inserted after the Interface panel (the panel of `#actionEchoCheck`) in the General tab; with no `#actionEchoCheck`, `hs.panel()` returns an error and adds nothing. The game finds its own sliders by id, so the HUD sliders do not change them. The Sharp UI row uses the game's own switch markup (`label.setting-toggle`), so it has no CSS of the mod. The styles are in `src/Web/page.css` and `tokens.css` (prefix `--hs-`); the script writes only values known at run time (the zoom, the font sizes, the place of the default mark as `--hs-mark`). `tests/page` (Vitest) runs the bundle against the game's own HUD and `OutSetting` pages.

## Release and config hygiene

- **Verbose ships off.** `Verbose` defaults to `false`. Tracing uses `LogDebug` behind it; `LogInfo` logs only the load line.
- **The plugin GUID never changes.** It is `com.ivmakk.survivallog.hudscale`, the BepInEx identity and config file name.
- **The version is in two places that must agree:** `<Version>` in the csproj and the `BepInPlugin` attribute.
- **Config docs match the code.** A change to a `Config.Bind` default, range, or name also changes `CONFIG.md`. The panel reads the range and default from the entries.
- **Config values change through the `ConfigEntry`**, so BepInEx clamps and saves them. Flag a direct write of the config file.
- **No committed build output.** Flag `bin/`, `obj/`, `dist/`, or a game DLL. Game `<Reference>` entries keep `<Private>false</Private>`.
- **Changelog matches the change.** A player-visible change adds a player-facing `[Unreleased]` entry to `CHANGELOG.md`; an internal refactor adds none.
