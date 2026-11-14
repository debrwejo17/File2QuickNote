# File2QuickNote

File2QuickNote is an Obsidian community plugin that creates a blank Markdown note next to a selected non-Markdown file. If the matching note already exists, the plugin opens it instead of replacing it.

Example:
- `Lectures/Databases/Relational Databases.pdf` → `Lectures/Databases/Relational Databases.md`

The plugin supports files without extensions, nested folders, and names containing spaces, umlauts, or punctuation. It removes only the last extension and does not modify the source file.

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
