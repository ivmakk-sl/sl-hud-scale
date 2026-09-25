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

- **Pure logic is separated and tested.** Game-free logic (message routing, the script call, the parse of panel messages, the config-file edit check) lives in `src/HudScaleLogic.cs` and `src/ConfigFileCheck.cs`, with no BepInEx or Il2Cpp reference, unit-tested under `tests/`. Flag new pure logic in `Plugin.cs` or with no test.
- **Patches** prefer a postfix; the `Harmony` instance uses the plugin GUID. Both patches are on `WebUILayer.OnMessageFromJS`. The Postfix installs the page script on ready messages and does not change the game's handling. The Prefix returns `false` only for the mod's own `HUDSCALE_` events of `OutSetting`; every other message, and any message on an error, returns `true`.
- **Numbers go to JavaScript with the invariant culture.** Flag a float in the script call without `CultureInfo.InvariantCulture` (a decimal-comma system writes `0,9`).
- **No change at the game's values.** At `HudZoom = 1.3` and `HudTextScale = 1.0` (the game's values, not the config defaults) the page script still runs for the sliders, but leaves each HUD page as the game has it; a page the mod changed before goes back to the game's style. Flag code that touches an unchanged HUD page at these values.
- **Page script.** `src/page.js` runs in the root page and reaches `CoreUI1` and `CoreUI0` through their iframes. It multiplies each px font size and divides each em width and height by the text scale, always from the original value, so em icons keep their size. It writes the body zoom only when the value differs, and changes no other page except the HUD panel in the `OutSetting` settings window, whose sliders come after the two volume sliders that the game finds by index. `tests/page` runs it against the game's own HUD and `OutSetting` pages.

## Release and config hygiene

- **Verbose ships off.** `Verbose` defaults to `false`. Tracing uses `LogDebug` behind it; `LogInfo` logs only the load line.
- **The plugin GUID never changes.** It is `com.ivmakk.survivallog.hudscale`, the BepInEx identity and config file name.
- **The version is in two places that must agree:** `<Version>` in the csproj and the `BepInPlugin` attribute.
- **Config docs match the code.** A change to a `Config.Bind` default, range, or name also changes `CONFIG.md`. The panel reads the range and default from the entries.
- **Config values change through the `ConfigEntry`**, so BepInEx clamps and saves them. Flag a direct write of the config file.
- **No committed build output.** Flag `bin/`, `obj/`, `dist/`, or a game DLL. Game `<Reference>` entries keep `<Private>false</Private>`.
- **Changelog matches the change.** A player-visible change adds a player-facing `[Unreleased]` entry to `CHANGELOG.md`; an internal refactor adds none.
