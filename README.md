# PickKit

Colour picker and font inspector for Chrome (Manifest V3).

## Try it in Chrome

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `.output/chrome-mv3`.

`npm run dev` does the same with hot reload, in a separate Chrome window.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development build with hot reload |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run zip` | Production build zipped for the Chrome Web Store |
| `npm test` | Unit tests (colour maths, font helpers, export) |
| `npm run typecheck` | TypeScript check |
| `npm run icons` | Regenerates PNG icons from `assets/icon.svg` |
| `npm run preview` | Builds, then serves the pages with stand-in `chrome.*` APIs at `http://localhost:4517/harness.html` |

## Layout

| Path | Contents |
|---|---|
| `core/` | Logic with no UI framework: colour maths, font detection, page scan, storage, export |
| `core/overlay/` | The in-page overlay: shadow-DOM shell, colour loupe, font inspector |
| `entrypoints/` | Background worker, injected overlay script, popup, side panel, settings, welcome page |
| `ui/` | Design tokens and shared React components |
| `public/_locales/` | Store listing name and description in ten languages |
| `scripts/preview/` | Test page and `chrome.*` stand-in used by `npm run preview` |

## Permissions

`activeTab`, `scripting`, `storage` and `sidePanel` only. PickKit reads a page when the user
invokes it there. All-sites access is an optional permission, requested from the side panel or
settings when the user turns on automatic page scanning.

## Before publishing

- Set `UNINSTALL_FEEDBACK_URL` in `core/config.ts` once a feedback form exists.
- `core/features.ts` is the single place to gate features if a paid tier is added.
