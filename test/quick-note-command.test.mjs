import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { ConfirmationModal, FileView, TFile, WorkspaceTabs, moment, notices } from "./obsidian-mock.mjs";

// Bundle the real plugin with an external Obsidian test double; the runtime
// API is provided by Obsidian and is not present in the npm type package.
const bundled = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "esm",
  write: false,
  plugins: [{
    name: "obsidian-mock",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./obsidian-mock.mjs", import.meta.url).href,
        external: true
      }));
    }
  }]
});
const { default: Plugin } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

function rect(left, top = 0, width = 100, height = 100) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function fixture(positions, sourceIndex = 0) {
  notices.length = 0;
  ConfirmationModal.instances.length = 0;
  const root = {};
  const panes = positions.map(() => new WorkspaceTabs(root));
  const leaves = [];
  const files = new Map();
  const created = [];
  const source = new TFile("folder/lecture.part.pdf");
  files.set(source.path, source);

  function makeLeaf(pane, file, bounds) {
    const leaf = {
      parent: pane,
      getContainer: () => root,
      getRoot() {
        let item = this;
        while (item.parent) item = item.parent;
        return item;
      },
      getViewState() {
        return { type: this.view.file ? "file" : "empty", state: { file: this.view.file?.path } };
      },
      async openFile(fileToOpen) { this.view.file = fileToOpen; },
      detach() { leaves.splice(leaves.indexOf(this), 1); }
    };
    leaf.view = new FileView(leaf, file, bounds);
    leaves.push(leaf);
    return leaf;
  }
  panes.forEach((pane, index) => makeLeaf(pane, index === sourceIndex ? source : null, positions[index]));

  const workspace = {
    activeLeaf: leaves[sourceIndex],
    leftSplit: {},
    rightSplit: {},
    splits: 0,
    newTabs: 0,
    on(name, callback) { this.menuCallback = callback; return {}; },
    getActiveViewOfType(type) { return this.activeLeaf.view instanceof type ? this.activeLeaf.view : null; },
    iterateAllLeaves(callback) { [...leaves].forEach(callback); },
    setActiveLeaf(leaf, options) { this.activeLeaf = leaf; this.lastFocus = options.focus; },
    async revealLeaf(leaf) { this.revealed = leaf; },
    createLeafBySplit(leaf, direction, before) {
      assert.equal(direction, "vertical");
      assert.equal(before, false);
      this.splits++;
      this.splitAnchor = leaf;
      const pane = new WorkspaceTabs(root);
      panes.push(pane);
      return makeLeaf(pane, null, rect(leaf.view.containerEl.getBoundingClientRect().right));
    },
    getLeaf(type) {
      if (type !== "tab") return this.activeLeaf;
      this.newTabs++;
      return makeLeaf(this.activeLeaf.parent, null, this.activeLeaf.view.containerEl.getBoundingClientRect());
    }
  };
  const vault = {
    getAbstractFileByPath: (path) => files.get(path) ?? null,
    async create(path, content) {
      assert.ok(!files.has(path), "must not overwrite an existing file");
      const file = new TFile(path);
      files.set(path, file);
      created.push({ path, content });
      return file;
    }
  };
  const plugin = new Plugin({ workspace, vault });
  plugin.onload();
  return { plugin, workspace, vault, source, panes, leaves, files, created, makeLeaf };
}

test("one pane with multiple tabs splits right and creates a note with a source link", async () => {
  const f = fixture([rect(0)]);
  f.makeLeaf(f.panes[0], new TFile("other.pdf"), rect(0));
  await f.plugin.command.callback();
  assert.equal(f.workspace.splits, 1);
  assert.deepEqual(f.created, [{
    path: "folder/lecture.part.md",
    content: "[Open file: lecture.part.pdf](<folder/lecture.part.pdf>)\n\n"
  }]);
  assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
  assert.equal(f.leaves[0].view.file, f.source);
  assert.equal(f.workspace.lastFocus, true);
});

test("the command uses the localized source link", async (t) => {
  t.mock.method(moment, "locale", () => "de");
  const f = fixture([rect(0)]);
  await f.plugin.command.callback();
  assert.equal(f.created[0].content, "[Datei öffnen: lecture.part.pdf](<folder/lecture.part.pdf>)\n\n");
});

for (const sourceIndex of [0, 1]) {
  test(`two panes: source in pane ${sourceIndex + 1} opens a new tab in the other pane`, async () => {
    const f = fixture([rect(0), rect(100)], sourceIndex);
    await f.plugin.command.callback();
    assert.equal(f.workspace.newTabs, 1);
    assert.equal(f.workspace.splits, 0);
    assert.equal(f.workspace.activeLeaf.parent, f.panes[1 - sourceIndex]);
    assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
    assert.equal(f.leaves[sourceIndex].view.file, f.source);
  });
}

test("nested layout chooses the spatially nearest right pane rather than traversal order", async () => {
  const f = fixture([rect(100), rect(400), rect(0), rect(200), rect(100, 100)], 0);
  await f.plugin.command.callback();
  assert.equal(f.workspace.activeLeaf.parent, f.panes[3]);
  assert.equal(f.workspace.splits, 0);
});

test("with no right neighbor, chooses the closest horizontally overlapping left pane", async () => {
  const f = fixture([rect(200), rect(0), rect(100), rect(200, 100)]);
  await f.plugin.command.callback();
  assert.equal(f.workspace.activeLeaf.parent, f.panes[2]);
  assert.equal(f.workspace.splits, 0);
});

test("when other panes are only above or below, splits right as fallback", async () => {
  const f = fixture([rect(0, 100), rect(0, 0), rect(0, 200)]);
  await f.plugin.command.callback();
  assert.equal(f.workspace.splits, 1);
});

test("reuses an existing file and an already open deferred target tab, ignoring other panes", async () => {
  const f = fixture([rect(0), rect(100), rect(200)]);
  const note = new TFile("folder/lecture.part.md");
  f.files.set(note.path, note);
  f.makeLeaf(f.panes[2], note, rect(200));
  const existing = f.makeLeaf(f.panes[1], null, rect(100));
  existing.getViewState = () => ({ state: { file: note.path } });
  await f.plugin.command.callback();
  assert.equal(f.created.length, 0);
  assert.equal(f.workspace.newTabs, 0);
  assert.equal(f.workspace.activeLeaf, existing);
  assert.equal(f.workspace.revealed, existing);
  assert.equal(f.workspace.lastFocus, true);
});

test("an existing tab in another pane does not override the desired target", async () => {
  const f = fixture([rect(100), rect(200), rect(0)]);
  const note = new TFile("folder/lecture.part.md");
  f.files.set(note.path, note);
  f.makeLeaf(f.panes[2], note, rect(0));
  await f.plugin.command.callback();
  assert.equal(f.workspace.activeLeaf.parent, f.panes[1]);
  assert.equal(f.workspace.newTabs, 1);
  assert.equal(f.created.length, 0);
});

test("invalid active views and Markdown files show a notice without workspace changes", async () => {
  for (const invalid of ["graph", "markdown", "missing"]) {
    const f = fixture([rect(0)]);
    if (invalid === "graph") f.workspace.activeLeaf.view = {};
    if (invalid === "markdown") f.workspace.activeLeaf.view.file = new TFile("folder/NOTE.MD");
    if (invalid === "missing") f.workspace.activeLeaf.view.file = null;
    await f.plugin.command.callback();
    assert.equal(notices.length, 1);
    assert.match(notices[0], /non-Markdown/);
    assert.equal(f.workspace.splits, 0);
    assert.equal(f.workspace.newTabs, 0);
    assert.equal(f.created.length, 0);
  }
});

test("a sidebar file is rejected even when its view belongs to a tab group", async () => {
  const f = fixture([rect(0)]);
  f.panes[0].parent = f.workspace.leftSplit;
  await f.plugin.command.callback();
  assert.match(notices[0], /non-Markdown/);
  assert.equal(f.created.length, 0);
  assert.equal(f.workspace.splits, 0);
});

test("an error while inspecting the active workspace produces a notice", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(0)]);
  f.workspace.activeLeaf.getRoot = () => { throw new Error("workspace unavailable"); };
  await f.plugin.command.callback();
  assert.match(notices[0], /workspace unavailable/);
  assert.equal(f.created.length, 0);
});

test("blocked note paths produce a notice without changing the workspace", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(0)]);
  f.files.set("folder/lecture.part.md", { folder: true });
  await f.plugin.command.callback();
  assert.match(notices[0], /directory/);
  assert.equal(f.workspace.splits, 0);
  assert.equal(f.created.length, 0);
});

for (const sourceIndex of [0, 1]) {
  test(`an empty target tab is reused when the source is in pane ${sourceIndex + 1}`, async () => {
    const f = fixture([rect(0), rect(100)], sourceIndex);
    const sourceLeaf = f.leaves[sourceIndex];
    const target = f.leaves[1 - sourceIndex];
    f.workspace.getLeaf = () => target;
    await f.plugin.command.callback();
    assert.equal(f.leaves.length, 2);
    assert.equal(target.view.file.path, "folder/lecture.part.md");
    assert.equal(sourceLeaf.view.file, f.source);
    assert.equal(f.workspace.activeLeaf, target);
    assert.equal(f.workspace.revealed, target);
    assert.equal(f.workspace.lastFocus, true);
    assert.equal(notices.length, 0);
  });
}

test("an existing occupied tab returned by Obsidian is not replaced or detached", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(0), rect(100)]);
  const target = f.leaves[1];
  const original = new TFile("other.pdf");
  target.view.file = original;
  f.workspace.getLeaf = () => target;
  await f.plugin.command.callback();
  assert.equal(f.leaves.includes(target), true);
  assert.equal(target.view.file, original);
  assert.equal(f.workspace.activeLeaf, f.leaves[0]);
  assert.match(notices[0], /target pane/);
});

test("an empty tab in the wrong pane is not reused or detached", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(100), rect(200), rect(0)]);
  const wrongTab = f.leaves[2];
  f.workspace.getLeaf = () => wrongTab;
  await f.plugin.command.callback();
  assert.equal(f.leaves.includes(wrongTab), true);
  assert.equal(wrongTab.view.file, null);
  assert.equal(f.leaves[0].view.file, f.source);
  assert.match(notices[0], /target pane/);
});

test("a new tab created in the wrong pane is removed without touching existing tabs", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(0), rect(100)]);
  f.workspace.getLeaf = () => f.makeLeaf(f.panes[0], null, rect(0));
  await f.plugin.command.callback();
  assert.equal(f.leaves.length, 2);
  assert.equal(f.leaves[0].view.file, f.source);
  assert.equal(f.workspace.activeLeaf, f.leaves[0]);
  assert.match(notices[0], /target pane/);
});

test("a device that cannot split does not replace the source", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture([rect(0)]);
  f.workspace.createLeafBySplit = () => f.makeLeaf(f.panes[0], null, rect(0));
  await f.plugin.command.callback();
  assert.equal(f.leaves.length, 1);
  assert.equal(f.leaves[0].view.file, f.source);
  assert.match(notices[0], /target pane/);
});

test("a concurrent creation is reused without overwriting", async () => {
  const f = fixture([rect(0)]);
  const note = new TFile("folder/lecture.part.md");
  f.vault.create = async (path) => { f.files.set(path, note); throw new Error("already exists"); };
  await f.plugin.command.callback();
  assert.equal(f.workspace.activeLeaf.view.file, note);
  assert.equal(f.created.length, 0);
});

test("changing the active view while creating a note does not redirect the workspace", async () => {
  const f = fixture([rect(0)]);
  let finish;
  f.vault.create = () => new Promise((resolve) => { finish = resolve; });
  const command = f.plugin.command.callback();
  f.workspace.activeLeaf.view = {};
  finish(new TFile("folder/lecture.part.md"));
  await command;
  assert.equal(f.workspace.splits, 0);
  assert.equal(f.workspace.newTabs, 0);
  assert.match(notices[0], /non-Markdown/);
});

test("context menu retains its link content and existing-note confirmation", async () => {
  const f = fixture([rect(0)]);
  const existingEmptyTab = f.makeLeaf(f.panes[0], null, rect(0));
  let click;
  const menu = { addItem: (fn) => fn({
    setTitle: () => ({ onClick: (callback) => { click = callback; } })
  }) };
  f.workspace.menuCallback(menu, f.source);
  click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.created, [{
    path: "folder/lecture.part.md",
    content: "[Open file: lecture.part.pdf](<folder/lecture.part.pdf>)\n\n"
  }]);
  assert.equal(f.workspace.splits, 1);
  assert.equal(f.leaves.length, 3);
  assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
  assert.equal(f.leaves[0].view.file, f.source);
  assert.equal(existingEmptyTab.view.file, null);
  assert.notEqual(f.workspace.activeLeaf.parent, f.leaves[0].parent);
  f.workspace.menuCallback(menu, f.source);
  click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ConfirmationModal.instances.length, 1);
  assert.equal(ConfirmationModal.instances[0].opened, true);
  assert.equal(f.created.length, 1);
  ConfirmationModal.instances[0].confirm();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.leaves.length, 4);
  assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
  assert.equal(f.leaves[0].view.file, f.source);
});

test("the context menu splits the main pane rather than a focused sidebar leaf", async () => {
  const f = fixture([rect(100)]);
  const mainLeaf = f.leaves[0];
  const sidebarLeaf = f.makeLeaf(f.panes[0], null, rect(0));
  sidebarLeaf.parent = f.workspace.leftSplit;
  f.workspace.activeLeaf = sidebarLeaf;
  const menu = { addItem: (fn) => fn({
    setTitle: () => ({ onClick: (callback) => { f.contextClick = callback; } })
  }) };
  f.workspace.menuCallback(menu, f.source);
  f.contextClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.workspace.splitAnchor, mainLeaf);
  assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
  assert.equal(f.workspace.activeLeaf.parent === mainLeaf.parent, false);
  assert.equal(mainLeaf.view.file, f.source);
});

test("the context menu reuses an empty tab in the rightmost pane", async () => {
  const f = fixture([rect(0), rect(100), rect(200)]);
  const rightmostEmpty = f.leaves[2];
  const menu = { addItem: (fn) => fn({
    setTitle: () => ({ onClick: (callback) => { f.contextClick = callback; } })
  }) };
  f.workspace.menuCallback(menu, f.source);
  f.contextClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.leaves.length, 3);
  assert.equal(f.workspace.activeLeaf, rightmostEmpty);
  assert.equal(rightmostEmpty.view.file.path, "folder/lecture.part.md");
  assert.equal(f.leaves[0].view.file, f.source);
});

test("the context menu creates a new tab in the rightmost pane when no tab is empty", async () => {
  const f = fixture([rect(0), rect(100), rect(200)]);
  f.leaves[1].view.file = new TFile("middle.pdf");
  f.leaves[2].view.file = new TFile("right.pdf");
  const menu = { addItem: (fn) => fn({
    setTitle: () => ({ onClick: (callback) => { f.contextClick = callback; } })
  }) };
  f.workspace.menuCallback(menu, f.source);
  f.contextClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.leaves.length, 4);
  assert.equal(f.workspace.activeLeaf.parent, f.panes[2]);
  assert.equal(f.workspace.activeLeaf.view.file.path, "folder/lecture.part.md");
  assert.equal(f.leaves[0].view.file, f.source);
});
