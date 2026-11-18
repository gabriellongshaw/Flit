# Developing Flit

Notes for running and changing the game.

## Running locally

The game uses ES modules, so serve the folder over HTTP (for example `python3 -m http.server`) rather than opening `index.html` directly. It is fully static, so it can be hosted on GitHub Pages or Vercel with no setup.

## Structure

Flit follows the same layout as Dash, with only what a one-button game needs.

- `index.html` is the home page and `play/index.html` is the game.
- `assets/css` holds `variables.css`, `main.css`, `animations.css` and `responsive.css` (all media queries live there), with one file per component in `components/`.
- `assets/js/core` holds shared helpers: audio and music, theme, motion, page transitions, storage and utils.
- `assets/js/components` holds the game parts: `game.js` (loop, scoring, collisions), `bird.js`, `pipes.js`, `world.js` (sky, day and night cycle, ground), `particles.js`, `stage.js` and the `sound.js` menu.
- `assets/js/pages` holds the entry scripts for the two pages.
- `scripts/` and `.github/workflows/` hold the release automation, and `version.json` holds the current version.

## Tuning

- **Feel:** `GRAVITY` and `FLAP_SPEED` at the top of `components/bird.js`.
- **Difficulty:** `BASE_SPEED`, `SPEED_PER_POINT` and `MAX_BOOST` at the top of `components/game.js`. The gap size, margins and spacing are at the top of `components/pipes.js`. Pillars are spaced by time, so they stay the same distance apart in seconds as the game speeds up.
- **Colours:** the bird and pillar colours come from `variables.css`. The sky colours are in `components/world.js`.

## Storage

The best score is saved in `localStorage` as `flit:best`, and the sound settings as `flit:sound`. Nothing is sent anywhere.

## Sound

All music and effects are generated in the browser with the Web Audio API. The tune is the `SCORE` list in `assets/js/core/music.js` and the effects are in `assets/js/core/audio.js`.

## Releases

Releases are automatic. Every push to `main` runs `.github/workflows/release.yml`, which runs `scripts/release.mjs`:

- It reads the commits since the last `v*` tag as conventional commits. `feat` bumps the minor version, `fix` and `perf` bump the patch, and `!` or a `BREAKING CHANGE` footer bumps the major. Other types alone do not release.
- It creates the tag and a GitHub Release with notes grouped into features, fixes and maintenance.
- It writes the new version to `version.json`, which the workflow commits with `[skip release]`. The home page reads that file to show the version in the footer, linking to the GitHub releases. If the branch blocks direct pushes from Actions, that step is skipped and the label keeps the last version.

Add `[skip release]` to a commit message to stop a push from releasing. If a release commit is undone, amended or force pushed, the next push moves the existing tag to the new commit and updates its release instead of making another version. The workflow can also be run by hand from the Actions tab, and `dry-run` only prints the next version and notes.

The first release will be `v0.1.0`, so `version.json` starts there.