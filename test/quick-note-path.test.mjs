import assert from "node:assert/strict";
import test from "node:test";
import { getQuickNotePath, isMarkdownExtension } from "../.test-build/quick-note-path.js";

test("removes only the final extension and keeps the source directory", () => {
  assert.equal(
    getQuickNotePath("Lectures/Databases/Relational Databases.pdf"),
    "Lectures/Databases/Relational Databases.md"
  );
  assert.equal(getQuickNotePath("folder/Vorlesung.WS26.pdf"), "folder/Vorlesung.WS26.md");
});

test("supports extensionless names, dotfiles, and special characters", () => {
  assert.equal(getQuickNotePath("Lectures/notes"), "Lectures/notes.md");
  assert.equal(getQuickNotePath("Lectures/.private"), "Lectures/.private.md");
  assert.equal(getQuickNotePath("Änderungen & Maße/Größe #1.png"), "Änderungen & Maße/Größe #1.md");
});

test("places root-level notes at the vault root and rejects a missing filename", () => {
  assert.equal(getQuickNotePath("Diagramm.png"), "Diagramm.md");
  assert.throws(() => getQuickNotePath("folder/"), /does not contain a file name/);
});

test("recognizes Markdown extensions without regard to case", () => {
  assert.equal(isMarkdownExtension("md"), true);
  assert.equal(isMarkdownExtension("MD"), true);
  assert.equal(isMarkdownExtension("png"), false);
  assert.equal(isMarkdownExtension(""), false);
});
