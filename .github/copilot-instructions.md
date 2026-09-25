# Copilot code-review instructions

This repo is a BepInEx 6 (IL2CPP) Harmony mod for *Survival Log*. Plugins derive from `BasePlugin` and call the game through Il2CppInterop proxy assemblies. Review with these traps in mind; a general C# review misses most of them.

## IL2CPP Harmony traps

- **Getter/setter patches often never fire.** il2cpp inlines trivial accessors, so a `MethodType.Getter`/`.Setter` patch silently does nothing. Flag a new getter patch used as the only mechanism. The reliable change is mutating the backing field at a load hook.
- **No `is`/`as` across the interop boundary.** Flag `is`, `as`, or a direct cast on a game type. The correct form is `x.TryCast<T>()` then a null check.
- **No `foreach` over game collections.** The interop enumerator lacks the pattern. Expect `GetEnumerator()` / `MoveNext()` / `Current`, or a count plus an indexer.
- **Never read an `Il2CppSystem.ValueTuple<...>` result of a game method,** direct or as a list element. The interop layer reads the fields wrongly and gives garbage with no error. Expect a method that returns a class, a dictionary, or an `Il2CppStructArray`, or the value calculated in the mod.
- **Guard game lookups.** Singletons and config lookups return null often. Flag an unchecked dereference inside a patch.
- **A patch must not break the game.** Each patch body sits in a try/catch that logs the error, so the HUD falls back to the game's own behavior.

## Structure and tests

- **Pure logic is separated and tested.** Logic that does not need the running game (which web view message starts the page script, the call it gets, the parse of the settings panel messages, and the check for a hand edit of the config file) lives in `src/HudScaleLogic.cs` and `src/ConfigFileCheck.cs` with no BepInEx or Il2Cpp reference, unit-tested under `tests/`. Flag new pure logic in `Plugin.cs`, and new pure logic with no test.
- **Patches** prefer a postfix, and tie the `Harmony` instance to the plugin GUID. Both patches are on `WebUILayer.OnMessageFromJS`. The Postfix installs the page script on the ready messages and must not change the game's handling of a message. The Prefix handles the mod's own `HUDSCALE_` events of the `OutSetting` page and returns `false` only for them, because the game does not know these events. Each other message, and each game message on an error, returns `true`.
- **Numbers go to JavaScript with the invariant culture.** Flag a float written into the script call without `CultureInfo.InvariantCulture`: a decimal-comma system writes `0,9`.
- **No change at the game's values.** At `HudZoom = 1.3` and `HudTextScale = 1.0` (the game's own values, not the config defaults) the page script still runs, because the settings window needs the sliders, but it leaves each HUD page as the game has it. A page that the mod changed before goes back to the game's style. Flag code that touches a HUD page that the mod never changed at these values.
- **Page script.** `src/page.js` runs in the root page and reaches the HUD pages (`CoreUI1`, `CoreUI0`) through their iframes. It scales each px font size from its original value (a second run gives the same result), writes the body zoom only when the value differs, and changes no page that is not a HUD page, except the HUD panel that it adds to the settings window of `OutSetting`. The panel's sliders come after the game's two volume sliders, which the page finds by index. `tests/page` runs it against the game's own `CoreUI1.html`, `CoreUI0.html`, and `OutSetting.html`.

## Release and config hygiene

- **Verbose ships off.** The `Verbose` config binds with default `false`. Diagnostic tracing goes on `LogDebug` behind it; `LogInfo` stays quiet apart from the load line.
- **The plugin GUID never changes.** It is `com.ivmakk.survivallog.hudscale`, the BepInEx identity and the config file name. Flag any edit to it.
- **The version is in two places that must agree:** `<Version>` in the csproj and the `BepInPlugin` attribute.
- **Config docs match the code.** A change to a `Config.Bind` default, range, or name also changes `CONFIG.md`. The settings panel takes the range and the default from the config entries, so it needs no change of its own.
- **Config values change through the `ConfigEntry`.** The settings panel sets `ConfigEntry.Value`, so BepInEx clamps the value and saves the file. Flag a direct write of the config file.
- **No committed build output.** Flag `bin/`, `obj/`, `dist/`, or a game DLL in the diff. Game `<Reference>` entries keep `<Private>false</Private>`.
- **Changelog matches the change.** A player-visible change adds an `[Unreleased]` entry to `CHANGELOG.md` in player-facing wording. An internal-only refactor gets none.
