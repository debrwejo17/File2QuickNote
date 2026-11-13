/**
 * Return the vault path for a quick note alongside a source file.
 * Only the final extension is removed; a dot at the start of a name is
 * treated as part of the name, so extensionless dotfiles remain intact.
 */
export function getQuickNotePath(sourcePath: string): string {
  const separatorIndex = sourcePath.lastIndexOf("/");
  const directory = separatorIndex === -1 ? "" : sourcePath.slice(0, separatorIndex);
  const fileName = sourcePath.slice(separatorIndex + 1);

  if (!fileName) {
    throw new Error("The source file path does not contain a file name.");
  }

  const extensionIndex = fileName.lastIndexOf(".");
  const noteName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const noteFileName = `${noteName}.md`;

  return directory ? `${directory}/${noteFileName}` : noteFileName;
}

export function isMarkdownExtension(extension: string): boolean {
  return extension.toLowerCase() === "md";
}
