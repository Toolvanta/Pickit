# Contributing to Pickit

Thanks for helping. Bug reports, translations and pull requests are all welcome.

## Reporting a bug

Open an issue at https://github.com/Toolvanta/Pickit/issues with:

- what you did, what you expected and what happened
- the page URL (if public), your Chrome version and Pickit version (Settings shows it)
- a screenshot if it is visual

## Making a change

1. Fork the repository and create a branch from `master`: `git checkout -b fix/short-name`.
2. `npm install`, then `npm run dev` (live extension) or `npm run preview` (pages in a normal tab).
3. Make the change. The README's **How to add things** section covers the common cases:
   text, languages, colour and export formats, settings and side panel tabs.
4. Check it:
   ```bash
   npm run typecheck
   npm test
   ```
5. If you changed the UI, try it in light and dark mode and at least one other language
   (`?lang=ar` in the preview checks right-to-left).
6. Commit with a clear message and open a pull request describing what changed and why.
   Include before/after screenshots for UI changes.

## Code style

- TypeScript strict mode; no unused locals or parameters.
- Logic that does not need the DOM goes in `src/core/` with unit tests.
- No visible string in code: use `t()` from `src/core/i18n.ts` and add it to every locale.
- Use the design tokens in `src/ui/tokens.css` rather than raw colours.
- Comments explain why, not what.

## Translations

Translation fixes are especially welcome. Edit `public/_locales/<lang>/messages.json`, keep
every `{0}` placeholder, and run `npm test` to check nothing is missing.
