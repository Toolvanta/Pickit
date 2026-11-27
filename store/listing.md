# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, ready to paste. Images are in
this folder; regenerate them with `npm run store` after changing the UI.

## Store listing tab

**Name** (from `public/_locales/*/messages.json`, `extName`; Chrome localises it automatically)

> Pickit - Color Picker & Font Detector

**Summary / short description** (`extDescription`, max 132 characters)

> Pick any color from a page or your screen, identify fonts on hover, check contrast and export palettes. Fast and keyboard-friendly.

**Category:** Developer Tools
**Language:** English (the listing is also localised into 9 more languages through `_locales`)

**Description**

```
Pickit is a colour picker and font detector for designers and front-end developers.

PICK ANY COLOUR
• A pixel-perfect loupe follows your cursor. Click to copy, Shift+click to pick several.
• Copy as HEX, RGB, HSL or OKLCH, in your preferred format.
• Spots the CSS variable (design token) behind a colour, like --brand-500.
• Pick from anywhere on your screen, even outside Chrome.

DETECT ANY FONT
• Hover any text to see its family, size, weight, line height, letter spacing and colour.
• Knows Google Fonts, Adobe Fonts and self-hosted fonts.
• Pin the card to copy the CSS or save the font for later.

A WORKSPACE IN THE SIDE PANEL
• Colour history with favourites and search.
• Shade scales from 50 to 950 and colour harmonies.
• Scan a whole page for its colours and fonts, and download a style guide.

CONTRAST YOU CAN TRUST
• WCAG 2 ratios and APCA (the WCAG 3 draft) side by side.
• One-click fixes: the smallest change that passes AA or AAA.
• Preview colours as seen with protanopia, deuteranopia, tritanopia and achromatopsia.

PALETTES READY FOR YOUR CODE
• Export as CSS variables, SCSS, Tailwind, design tokens (W3C format), JSON or SVG.
• Optional sync of palettes and favourites across your Chrome profiles.
• Backup and restore everything as one file.

PRIVATE BY DESIGN
• Pickit only reads a page when you invoke it. It never watches what you browse.
• Everything is stored in your browser. No account, no analytics, no server.
• Available in English, Deutsch, Español, Français, Português, Русский, العربية, 日本語, 简体中文 and हिन्दी.

Keyboard shortcuts: Alt+Shift+C picks a colour, Alt+Shift+F inspects a font.

Pickit is open source: https://github.com/Toolvanta/Pickit
Sponsored by ToolEnhancer (https://toolenhancer.com), free online tools for images, video, audio and PDFs. The sponsor credit appears only on Pickit's own pages, never on websites you visit.
```

**Graphic assets**

| Asset | Size | File |
|---|---|---|
| Store icon | 128×128 | `icon-128.png` |
| Screenshot 1 | 1280×800 | `screenshots/1-pick-colours.png` |
| Screenshot 2 | 1280×800 | `screenshots/2-detect-fonts.png` |
| Screenshot 3 | 1280×800 | `screenshots/3-workspace.png` |
| Screenshot 4 | 1280×800 | `screenshots/4-contrast.png` |
| Screenshot 5 | 1280×800 | `screenshots/5-palettes.png` |
| Small promo tile | 440×280 | `promo/small-tile-440x280.png` |
| Marquee promo tile | 1400×560 | `promo/marquee-1400x560.png` |

**Additional fields**

- Official URL / homepage: `https://github.com/Toolvanta/Pickit`
- Support URL: `https://github.com/Toolvanta/Pickit/issues`

## Privacy practices tab

**Single purpose**

> Pickit helps designers and developers inspect web pages: it picks colours, detects fonts, checks colour contrast and saves palettes.

**Permission justifications**

| Permission | Justification |
|---|---|
| `activeTab` | Lets Pickit read the current tab only after the user clicks the toolbar icon or presses a Pickit shortcut. |
| `scripting` | Injects the colour picker and font inspector into the current tab when the user starts one. Nothing is injected otherwise. |
| `storage` | Saves the user's colour history, fonts, palettes and settings in the browser, and (only if the user turns it on) syncs palettes and favourites through Chrome sync. |
| `sidePanel` | Shows the Pickit workspace (history, contrast checker, palettes, page scan) in Chrome's side panel. |
| `<all_urls>` (optional host permission) | Requested only when the user clicks "Allow on all sites" in the side panel, so pickers started from the side panel can reach the page. Not granted at install. |

**Remote code:** No, Pickit does not use remote code. All code ships in the package.

**Data usage:** Pickit does not collect or transmit any user data. Tick none of the data types. Certify:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/Toolvanta/Pickit/blob/master/PRIVACY.md`

## Before you submit

1. Bump `version` in `package.json` for every new upload.
2. `npm run zip` and upload `.output/pickit-<version>-chrome.zip`.
3. Mention the sponsor credit in the description (already included above).
