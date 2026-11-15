import {
  ConfirmationModal, FileView, Notice, Plugin, TFile, WorkspaceTabs
} from "obsidian";
import type { WorkspaceItem, WorkspaceLeaf } from "obsidian";
import { getQuickNotePath, isMarkdownExtension } from "./quick-note-path";
import { getTranslations } from "./translations";

export default class File2QuickNotePlugin extends Plugin {
  override onload(): void {
    const t = getTranslations();

    // The workspace emits "file-menu" whenever Obsidian builds a file context
    // menu. TAbstractFile also includes folders, so accept only actual files.
    // registerEvent ties this listener's lifetime to the plugin's lifetime.
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, abstractFile) => {
        if (!(abstractFile instanceof TFile) || isMarkdownExtension(abstractFile.extension)) {
          return;
        }

        menu.addItem((item) => {
          item
            .setTitle(t.createQuickNote)
            .onClick(() => {
              void this.createOrOpenQuickNote(abstractFile);
            });
        });
      })
    );

    // Obsidian owns shortcut configuration for registered commands.
    this.addCommand({
      id: "open-quicknote-for-active-file",
      name: t.openQuickNote,
      callback: () => this.openQuickNoteForActiveFile()
    });
  }

  private async findOrCreateQuickNote(sourceFile: TFile): Promise<{ file: TFile; existed: boolean }> {
    const notePath = getQuickNotePath(sourceFile.path);
    const existingFile = this.app.vault.getAbstractFileByPath(notePath);
    if (existingFile instanceof TFile) {
      return { file: existingFile, existed: true };
    }
    if (existingFile) {
      throw new Error(getTranslations().directoryBlockingError(notePath));
    }

    try {
      const content = `[${getTranslations().fileLink(sourceFile.name)}](<${sourceFile.path}>)\n\n`;
      return { file: await this.app.vault.create(notePath, content), existed: false };
    } catch (error) {
      // Vault.create never overwrites; another action may have won the race.
      const fileCreatedInParallel = this.app.vault.getAbstractFileByPath(notePath);
      if (fileCreatedInParallel instanceof TFile) {
        return { file: fileCreatedInParallel, existed: false };
      }
      throw error;
    }
  }

  private async createOrOpenQuickNote(sourceFile: TFile): Promise<void> {
    const t = getTranslations();

    try {
      const { file: noteFile, existed } = await this.findOrCreateQuickNote(sourceFile);
      if (existed) {
        // Show a confirmation modal before opening an existing note.
        const modal = new ConfirmationModal(this.app);
        modal.contentEl.createDiv().setText(t.noteExistsMessage(sourceFile.name));
        modal.addButton((btn) => {
          btn.setButtonText(t.openButton).onClick(() => {
            void this.openQuickNoteInNewTab(noteFile).catch((error) => this.showFailure(error));
            modal.close();
          });
        });
        modal.addCancelButton();
        modal.open();
        return;
      }

      await this.openQuickNoteInNewTab(noteFile);
    } catch (error) {
      this.showFailure(error);
    }
  }

  private async openQuickNoteInNewTab(noteFile: TFile): Promise<void> {
    const workspace = this.app.workspace;
    const activeLeaf = workspace.activeLeaf;
    if (!activeLeaf) {
      throw new Error(getTranslations().unsupportedPane);
    }

    const container = activeLeaf.getContainer();
    const panes = new Map<WorkspaceTabs, WorkspaceLeaf[]>();
    workspace.iterateAllLeaves((leaf) => {
      if (leaf.parent instanceof WorkspaceTabs && leaf.getContainer() === container &&
          this.isMainAreaLeaf(leaf)) {
        const leaves = panes.get(leaf.parent) ?? [];
        leaves.push(leaf);
        panes.set(leaf.parent, leaves);
      }
    });

    const positionedPanes = [...panes.entries()].map((pane) => ({
      pane,
      right: Math.max(...pane[1].map((leaf) => leaf.view.containerEl.getBoundingClientRect().right))
    }));
    if (positionedPanes.length === 0 ||
        (positionedPanes.length > 1 && positionedPanes.some(({ right }) => !Number.isFinite(right)))) {
      throw new Error(getTranslations().unsupportedPane);
    }
    if (positionedPanes.length === 1) {
      const [targetPane, targetLeaves] = positionedPanes[0].pane;
      const originalLeaves = new Set(targetLeaves);
      const splitAnchor = targetLeaves.includes(activeLeaf) ? activeLeaf : targetLeaves[0];
      const noteLeaf = workspace.createLeafBySplit(splitAnchor, "vertical", false);
      if (noteLeaf.parent === targetPane) {
        if (!originalLeaves.has(noteLeaf)) noteLeaf.detach();
        workspace.setActiveLeaf(activeLeaf, { focus: true });
        throw new Error(getTranslations().unsupportedPane);
      }
      await noteLeaf.openFile(noteFile);
      await workspace.revealLeaf(noteLeaf);
      workspace.setActiveLeaf(noteLeaf, { focus: true });
      return;
    }

    const target = positionedPanes.reduce((rightmost, candidate) =>
      candidate.right > rightmost.right ? candidate : rightmost
    ).pane;
    const emptyLeaf = target[1].find((leaf) => leaf.getViewState().type === "empty");
    const originalLeaves = new Set([...panes.values()].flat());
    const originalActiveLeaf = activeLeaf;

    let noteLeaf = emptyLeaf;
    if (!noteLeaf) {
      workspace.setActiveLeaf(target[1][0], { focus: false });
      noteLeaf = workspace.getLeaf("tab");
      if (noteLeaf.parent !== target[0] ||
          (originalLeaves.has(noteLeaf) && noteLeaf.getViewState().type !== "empty")) {
        if (!originalLeaves.has(noteLeaf)) noteLeaf.detach();
        workspace.setActiveLeaf(originalActiveLeaf, { focus: true });
        throw new Error(getTranslations().unsupportedPane);
      }
    }

    await noteLeaf.openFile(noteFile);
    await workspace.revealLeaf(noteLeaf);
    workspace.setActiveLeaf(noteLeaf, { focus: true });
  }

  private showFailure(error: unknown): void {
    const details = error instanceof Error ? error.message : String(error);
    console.error("File2QuickNote could not create or open a note.", error);
    new Notice(getTranslations().failureNotice(details));
  }

  private async openQuickNoteForActiveFile(): Promise<void> {
    const workspace = this.app.workspace;
    const t = getTranslations();
    try {
      // Unlike getActiveFile(), getActiveViewOfType does not fall back to a
      // previously active file when a graph or another non-file view is focused.
      const view = workspace.getActiveViewOfType(FileView);
      const sourceFile = view?.file;
      const sourceLeaf = view?.leaf;
      if (!(sourceFile instanceof TFile) || isMarkdownExtension(sourceFile.extension) ||
          !sourceLeaf || !(sourceLeaf.parent instanceof WorkspaceTabs) || !this.isMainAreaLeaf(sourceLeaf)) {
        new Notice(t.invalidActiveFile);
        return;
      }

      const { file: noteFile } = await this.findOrCreateQuickNote(sourceFile);
      // Do not redirect the workspace if the user changed views during I/O.
      if (workspace.getActiveViewOfType(FileView) !== view || view.file !== sourceFile ||
          !this.isMainAreaLeaf(sourceLeaf)) {
        new Notice(t.invalidActiveFile);
        return;
      }

      // Leaves are tabs, not panes. Obsidian supplies their WorkspaceTabs
      // parents; grouping by object identity counts each tab bar only once.
      const panes = new Map<WorkspaceTabs, WorkspaceLeaf[]>();
      workspace.iterateAllLeaves((leaf) => {
        if (leaf.parent instanceof WorkspaceTabs && this.isMainAreaLeaf(leaf) &&
            leaf.getContainer() === sourceLeaf.getContainer()) {
          const tabs = panes.get(leaf.parent) ?? [];
          tabs.push(leaf);
          panes.set(leaf.parent, tabs);
        }
      });
      const sourcePane = sourceLeaf.parent;
      if (!panes.has(sourcePane)) {
        throw new Error(t.unsupportedPane);
      }
      const originalLeaves = new Set([...panes.values()].flat());

      let noteLeaf: WorkspaceLeaf;
      const otherPanes = [...panes.entries()].filter(([pane]) => pane !== sourcePane);
      const target = otherPanes.length === 1
        ? otherPanes[0]
        : this.findHorizontalNeighbor(sourceLeaf, otherPanes);

      if (!target) {
        // A single pane, or no horizontally adjacent pane: split this exact
        // source leaf to the right, rather than replacing the original view.
        noteLeaf = workspace.createLeafBySplit(sourceLeaf, "vertical", false);
        // On devices that cannot split, Obsidian may return a tab in the
        // original group instead. Do not silently replace the source file.
        if (noteLeaf.parent === sourcePane) {
          if (!originalLeaves.has(noteLeaf)) noteLeaf.detach();
          workspace.setActiveLeaf(sourceLeaf, { focus: true });
          throw new Error(t.unsupportedPane);
        }
      } else {
        const [targetPane, targetLeaves] = target;
        // getViewState also exposes the file path of deferred background tabs,
        // whose current view may not yet be a loaded FileView.
        const existing = targetLeaves.find((leaf) => leaf.getViewState().state?.file === noteFile.path);
        if (existing) {
          await workspace.revealLeaf(existing);
          workspace.setActiveLeaf(existing, { focus: true });
          return;
        }

        // getLeaf('tab') creates a tab in Obsidian's preferred location.
        // First activate the target group, then verify the resulting parent:
        // the public API does not provide a direct create-tab-in-group method.
        workspace.setActiveLeaf(targetLeaves[0], { focus: false });
        noteLeaf = workspace.getLeaf("tab");
        // Obsidian may return an existing empty tab instead of creating a new
        // one. Reusing that tab in the selected pane is safe; never replace a
        // tab with content or open the note in a different pane.
        if (noteLeaf.parent !== targetPane ||
            (originalLeaves.has(noteLeaf) && noteLeaf.getViewState().type !== "empty")) {
          if (!originalLeaves.has(noteLeaf)) noteLeaf.detach();
          workspace.setActiveLeaf(sourceLeaf, { focus: true });
          throw new Error(t.unsupportedPane);
        }
      }

      await noteLeaf.openFile(noteFile);
      await workspace.revealLeaf(noteLeaf);
      workspace.setActiveLeaf(noteLeaf, { focus: true });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      console.error("File2QuickNote could not create or open a note.", error);
      new Notice(t.failureNotice(details));
    }
  }

  private isMainAreaLeaf(leaf: WorkspaceLeaf): boolean {
    // Obsidian exposes the sidebar roots directly, even on mobile where their
    // implementation class is not necessarily exported at runtime. A popout
    // window has a different root and remains eligible.
    const root = leaf.getRoot();
    const { leftSplit, rightSplit } = this.app.workspace;
    if (root === leftSplit || root === rightSplit) return false;
    const container = leaf.getContainer();
    let item: WorkspaceItem = leaf;
    while (item !== container) {
      if (!item.parent) return false;
      item = item.parent;
    }
    return true;
  }

  private findHorizontalNeighbor(
    sourceLeaf: WorkspaceLeaf,
    panes: [WorkspaceTabs, WorkspaceLeaf[]][]
  ): [WorkspaceTabs, WorkspaceLeaf[]] | undefined {
    // The public split/tab types expose parents but not children, orientation,
    // or sizes. Measure the visible views belonging to those parent groups:
    // rectangles reflect nested splits and actual spatial adjacency, unlike
    // the arbitrary traversal order of WorkspaceLeaf objects.
    const source = sourceLeaf.view.containerEl.getBoundingClientRect();
    if (source.width <= 0 || source.height <= 0) return undefined;
    let right: { pane: [WorkspaceTabs, WorkspaceLeaf[]]; gap: number } | undefined;
    let left: { pane: [WorkspaceTabs, WorkspaceLeaf[]]; gap: number } | undefined;
    for (const pane of panes) {
      const rect = pane[1].map((leaf) => leaf.view.containerEl.getBoundingClientRect())
        .find((bounds) => bounds.width > 0 && bounds.height > 0);
      if (!rect || Math.min(source.bottom, rect.bottom) <= Math.max(source.top, rect.top)) continue;
      // A one-pixel tolerance accommodates rounding at split boundaries.
      const rightGap = rect.left - source.right;
      const leftGap = source.left - rect.right;
      if (rightGap >= -1 && (!right || rightGap < right.gap)) right = { pane, gap: rightGap };
      if (leftGap >= -1 && (!left || leftGap < left.gap)) left = { pane, gap: leftGap };
    }
    return right?.pane ?? left?.pane;
  }
}
