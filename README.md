# File2QuickNote

File2QuickNote is an Obsidian community plugin that creates a blank Markdown note next to a selected non-Markdown file. If the matching note already exists, the plugin opens it instead of replacing it.

Examples:

- `Lectures/Databases/Relational Databases.pdf` → `Lectures/Databases/Relational Databases.md`
- `Images/Diagramm.png` → `Images/Diagramm.md`
- `Lectures/Vorlesung.WS26.pdf` → `Lectures/Vorlesung.WS26.md`

The plugin supports files without extensions, nested folders, and names containing spaces, umlauts, or punctuation. It removes only the last extension and does not modify the source file.

## Development setup

Requirements: Node.js and npm.

```sh
npm install
npm run build
```

`npm run build` first checks the TypeScript types and then bundles `src/main.ts` into `build/main.js`, which is the entry point Obsidian loads. `manifest.json` supplies the plugin metadata, and `versions.json` maps plugin versions to their minimum Obsidian versions. The Obsidian API package is used for type checking; esbuild leaves `obsidian` external because the host application provides it at runtime.

For iterative development, run:

```sh
npm run dev
```

This keeps esbuild watching the source and regenerates `main.js` whenever a file changes. In Obsidian, enable the plugin under **Settings → Community plugins**. After rebuilding, reload the plugin (or restart Obsidian) to load the updated bundle.

## Local installation

For a development vault, copy `build/main.js`, `manifest.json`, and `versions.json` into:

```text
<vault>/.obsidian/plugins/file2quicknote/
```

Alternatively, make the project directory itself that plugin folder (though you must first run `npm run build` to generate `build/main.js`). Enable **File2QuickNote** in Obsidian's Community plugins settings. The plugin bundle is not automatically copied into a vault by the build.

## How it works

`File2QuickNotePlugin` extends Obsidian's `Plugin` base class. Obsidian creates and loads this class when the plugin is enabled. Its `onload()` method subscribes to the workspace `file-menu` event; the callback receives the menu and the selected abstract vault file. The plugin checks that the item is a `TFile` (not a `TFolder`) and excludes `.md` extensions without regard to case. `registerEvent()` makes Obsidian dispose of the listener when the plugin is unloaded, so no custom `onunload()` cleanup is needed.

When the menu item is selected, the helper in `src/quick-note-path.ts` derives a sibling path by removing only the final extension. The plugin uses `Vault.getAbstractFileByPath()` to find an existing note and `Vault.create()` to create a blank one through Obsidian's vault API. If a create attempt loses a race to another file creation, it checks the vault again and opens the new note rather than overwriting it. Finally, `Workspace.getLeaf(false).openFile()` opens the note in the active leaf. Errors are written to the developer console and shown as an Obsidian `Notice`.

## Tests

Run the TypeScript-backed path tests with:

```sh
npm test
```

The tests cover root and nested paths, multiple periods, extensionless files, dotfiles, and special characters. The collision handling and actual Obsidian workspace interaction require a running Obsidian vault; they are not simulated by these unit tests.

## Community directory release checklist

1. Publish the source repository on GitHub and confirm the plugin ID (`file2quicknote`) is stable.
2. Update the version in `package.json` and `manifest.json`, and add the version-to-`minAppVersion` entry to `versions.json`.
3. Run `npm test` and `npm run build`, then create a GitHub release/tag matching the manifest version.
4. Attach the built `build/main.js` and `manifest.json` to the release. Include `styles.css` only if the plugin adds one.
5. Follow the current [Obsidian plugin submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) to submit the repository to the Community Plugin Directory.

## License

This project is distributed under the MIT License; see [LICENSE](./LICENSE).
