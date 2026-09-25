# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
