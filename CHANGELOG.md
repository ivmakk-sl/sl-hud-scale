# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-10-10

### Added

- **Sharp UI**: the game interface is drawn at a resolution close to the screen resolution, so text and lines look clearer, mostly on a wide screen, for example a 4K screen. The game limits this resolution by the graphics setting. Sharp UI uses more graphics memory and can slow the game. A switch in the HUD panel turns it off, and the config key is `SharpUI` in the `[Display]` section (default `true`).

## [1.1.2] - 2026-09-29

### Removed

- Support for game versions before 1.1.18153 (the Autumn Update). HUD Scale 1.1.2 needs Survival Log 1.1.18153 or later.

### Fixed

- The HUD panel in the new settings window of the Autumn Update: it is its own panel with its own title, the last panel of the General tab after Interface. Before, it showed inside the Sound panel with a second title.

## [1.1.1] - 2026-09-25

### Changed

- **Text Scale** no longer changes the size of HUD icons, such as the phone, bag, timer, and survival log icons. Icons follow only **Scale**.

## [1.1.0] - 2026-09-25

### Added

- A HUD panel in the settings window (Esc, then Settings, after a save loads), with a Scale slider for `HudZoom` and a Text Scale slider for `HudTextScale`. The HUD shows the new value while you drag, and a release saves it to the config file. A click on a number sets the default again.

### Changed

- A change of the config file applies when the settings window opens or a save loads. A restart is no longer necessary.

## [1.0.0] - 2026-09-25

### Added

- `HudZoom` setting for scaling the main HUD's text, icons, and boxes together. The default is `1.0`, which makes the main HUD about 23% smaller than the game's `1.3`.
- `HudTextScale` setting for scaling HUD text and icons that use font sizes without resizing their boxes. The default is `1.0`, which preserves the original font sizes.
- Text scaling for other mods that use pixel font sizes in HUD stylesheets, including Trapline.
