# File2QuickNote

File2QuickNote is an Obsidian community plugin that creates a Markdown note next to a selected non-Markdown file. It never replaces an existing note.

Example:
- `Lectures/Databases/Relational Databases.pdf` → `Lectures/Databases/Relational Databases.md`

The plugin supports files without extensions, nested folders, and names containing spaces, umlauts, or punctuation. It removes only the last extension and does not modify the source file.

## Usage

- In the file explorer, choose **Create QuickNote** on a non-Markdown file. A new note contains a link to the source file; for an existing note, confirm before opening it. With one pane, the note opens in a new pane to the right. With multiple panes, it opens in an empty tab in the rightmost pane when available, or a new tab there.
- With a non-Markdown file focused in the main workspace, run **Open QuickNote for active file** from the command palette. A new note contains the same link to the source file; an existing note is opened without modification. Assign a shortcut in Obsidian's **Settings → Hotkeys**.

The command counts tab groups as panes, not individual tabs. It splits a single pane to the right; with two panes it uses the other pane. With more panes, it chooses the closest horizontally adjacent pane, preferring the right. If there is no horizontal neighbor, or the layout cannot be measured, it splits the source pane to the right instead. An existing note tab in the chosen pane is activated; a tab in another pane is not reused. Sidebar panes are excluded, and popout windows are handled separately.

Obsidian controls where a new tab is created and may return an existing empty tab in the selected pane instead; the command uses that tab. If Obsidian cannot provide a new or empty tab in the selected pane, or the device cannot split the source pane, the command reports the error rather than replacing an occupied tab or opening the note in the wrong pane.

## Development setup

Requirements: Node.js and npm.

## Local installation

For a development vault, copy `build/main.js`, `manifest.json`, and `versions.json` into:

```text
<vault>/.obsidian/plugins/file2quicknote/
```

Alternatively, make the project directory itself that plugin folder (though you must first run `npm run build` to generate `build/main.js`). Enable **File2QuickNote** in Obsidian's Community plugins settings. The plugin bundle is not automatically copied into a vault by the build.

## License

This project is distributed under the MIT License; see [LICENSE](./LICENSE).
