import { ConfirmationModal, Notice, Plugin, TFile } from "obsidian";
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
  }

  private async createOrOpenQuickNote(sourceFile: TFile): Promise<void> {
    const t = getTranslations();

    try {
      const notePath = getQuickNotePath(sourceFile.path);
      const existingFile = this.app.vault.getAbstractFileByPath(notePath);
      let noteFile: TFile;

      if (existingFile instanceof TFile) {
        // Show a confirmation modal before opening an existing note.
        const modal = new ConfirmationModal(this.app);
        modal.contentEl.createDiv().setText(t.noteExistsMessage(sourceFile.name));
        modal.addButton((btn) => {
          btn.setButtonText(t.openButton).onClick(() => {
            void this.app.workspace.getLeaf(false).openFile(existingFile);
            modal.close();
          });
        });
        modal.addCancelButton();
        modal.open();
        return;
      } else if (existingFile) {
        throw new Error(t.directoryBlockingError(notePath));
      } else {
        try {
          // Extract the file name for the link text.
          const fileName = sourceFile.name;

          // Create a blank note with only a link back to the source file.
          const content = `[${t.fileLink(fileName)}](<${sourceFile.path}>)\n\n`;

          // Vault.create uses Obsidian's adapter and rejects an existing path.
          noteFile = await this.app.vault.create(notePath, content);
        } catch (createError) {
          // Another action may have created the note after our initial lookup.
          // Reuse it if it is now present rather than trying to overwrite it.
          const fileCreatedInParallel = this.app.vault.getAbstractFileByPath(notePath);
          if (fileCreatedInParallel instanceof TFile) {
            noteFile = fileCreatedInParallel;
          } else {
            throw createError;
          }
        }
      }

      // Reuse the active workspace leaf and let Obsidian open the vault file.
      await this.app.workspace.getLeaf(false).openFile(noteFile);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      console.error("File2QuickNote could not create or open a note.", error);
      new Notice(t.failureNotice(details));
    }
  }
}
