# Obsidian Plugin Contribution Guide

- Absolutely no TypeScript is allowed; use JavaScript only.
- The build must output `main.js` at the repository root (Obsidian plugin entry).
- Keep dependencies minimal and use `esbuild` for bundling.
- Never commit secrets; the OpenRouter API key must be stored in Obsidian plugin settings locally.

## How to build
1. Install dependencies with `npm install`.
2. Bundle the plugin using `npx esbuild src/main.js --bundle --platform=node --format=cjs --outfile=main.js`.

## How to install in Obsidian
1. Copy this repository folder into your vault's `.obsidian/plugins/lazydungeonmaster` directory.
2. Ensure `manifest.json` and the built `main.js` exist at the plugin root, then enable the plugin from Obsidian's Community Plugins settings.
