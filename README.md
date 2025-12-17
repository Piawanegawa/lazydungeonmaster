# Lazy Dungeon Master

Lazy Dungeon Master is a simple Obsidian plugin that adds a friendly command to greet you inside your vault.

## Installation

1. Build the plugin (see below) so that `main.js` is present at the repository root alongside `manifest.json`.
2. Copy the entire repository folder into your vault's `.obsidian/plugins/lazydungeonmaster` directory.
3. Enable **Lazy Dungeon Master** from Obsidian's Community Plugins settings.

## Development

This project uses `esbuild` to bundle the source into `main.js`.

- **Install dependencies**
  ```bash
  npm install
  ```
- **Build once**
  ```bash
  npm run build
  ```
- **Watch for changes**
  ```bash
  npm run dev
  ```

## Command

- **Lazy DM: Hello** — shows a brief notice greeting from the plugin.
