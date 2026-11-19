# Developing Flit

Notes for running and changing the game.

## Running locally

The game uses ES modules, so serve the folder over HTTP (for example `python3 -m http.server`) rather than opening `index.html` directly. The pages are static (GitHub Pages or Vercel), but coins, the shop and the leaderboard need the API in `api/game.js` deployed to Vercel. See Online setup below.

## Structure

Flit follows the same layout as Dash, with only what a one-button game needs.

- `index.html` is the home page and `play/index.html` is the game.
- `assets/css` holds `variables.css`, `main.css`, `animations.css` and `responsive.css` (all media queries live there), with one file per component in `components/`.
- `assets/js/core` holds shared helpers: audio and music, theme, motion, page transitions, storage and utils.
- `assets/js/components` holds the game parts: `game.js` (loop, scoring, collisions), `bird.js`, `pipes.js`, `world.js` (sky, day and night cycle, ground), `particles.js`, `stage.js` and the `sound.js` menu.
- `assets/js/pages` holds the entry scripts for the pages: home, game, shop and leaderboard.
- `assets/js/core/cosmetics.js` and `worlds.js` list every shop item and price (the server reads the same files). `components/hats.js` draws the hats.
- `api/game.js` is the Vercel serverless function behind the shop and leaderboard.
- `scripts/` and `.github/workflows/` hold the release automation, and `version.json` holds the current version.

## Tuning

- **Feel:** `GRAVITY` and `FLAP_SPEED` at the top of `components/bird.js`.
- **Difficulty:** `BASE_SPEED`, `SPEED_PER_POINT` and `MAX_BOOST` at the top of `components/game.js`. The gap size, margins and spacing are at the top of `components/pipes.js`. Pillars are spaced by time, so they stay the same distance apart in seconds as the game speeds up.
- **Colours:** the sunset theme colours come from `variables.css`. The default bird and pillar colours are `--runner` and `--hazard`. Sky and scenery colours for each world are in `core/worlds.js`.
- **Shop:** add an item by adding it to the lists in `core/cosmetics.js` (or `core/worlds.js` for worlds). Hats are drawn in `components/hats.js`.

## Storage

The best score is saved in `localStorage` as `flit:best`, the sound settings as `flit:sound`, and a cached copy of the profile as `flit:profile` (the server copy replaces it on every sync).

## Blur and graphics

Page headers use a layered backdrop blur, copied from Dash. `core/graphics.js` picks Full, Lite or Off in Auto mode by measuring frame rate (and battery, data saver and device hints), and the speaker menu has a Blur setting (Auto, On, Off) stored as `flit:graphics`. The CSS classes are `lite-blur` and `no-blur` on `<html>`.

## Profile

`profile/index.html` lets signed-in players set a username (unique, once a day), a display name, whether the Google photo is shown, and whether they appear on the leaderboard. The board shows the username, then the display name, then the Google name. Usernames are reserved in the `flitUsernames` collection.

## Online setup

Flit shares Dash's Firebase project but uses its own Firestore collections (`flitProfiles`, `flitBoard`, `flitWeeks`). All reads and writes go through the API, so no Firestore rule changes are needed.

1. In Firebase, enable Anonymous and Google sign-in, and add the domain that hosts Flit under Authentication, Settings, Authorized domains.
2. Create a service account key (Project settings, Service accounts, Generate new private key).
3. Create a Vercel project from this repo (it deploys `api/game.js`) and add the key's JSON as the `FIREBASE_SERVICE_ACCOUNT` environment variable.
4. Set `API_URL` at the top of `assets/js/core/profile.js` to that project's `/api/game` address.
5. Check `ORIGINS` at the top of `api/game.js` lists the site that serves the game.

The server checks every run before paying coins: the run must come from a signed token, the score cannot exceed what is possible in the elapsed time, the flap count must be plausible, and a token cannot be replayed. Prices are read from `cosmetics.js` on the server, never from the client.

## Sound

All music and effects are generated in the browser with the Web Audio API. The tune is the `SCORE` list in `assets/js/core/music.js` and the effects are in `assets/js/core/audio.js`.

## Releases

Releases are automatic. Every push to `main` runs `.github/workflows/release.yml`, which runs `scripts/release.mjs`:

- It reads the commits since the last `v*` tag as conventional commits. `feat` bumps the minor version, `fix` and `perf` bump the patch, and `!` or a `BREAKING CHANGE` footer bumps the major. Other types alone do not release.
- It creates the tag and a GitHub Release with notes grouped into features, fixes and maintenance.
- It writes the new version to `version.json`, which the workflow commits with `[skip release]`. The home page reads that file to show the version in the footer, linking to the GitHub releases. If the branch blocks direct pushes from Actions, that step is skipped and the label keeps the last version.

Add `[skip release]` to a commit message to stop a push from releasing. If a release commit is undone, amended or force pushed, the next push moves the existing tag to the new commit and updates its release instead of making another version. The workflow can also be run by hand from the Actions tab, and `dry-run` only prints the next version and notes.

The first release will be `v0.1.0`, so `version.json` starts there.