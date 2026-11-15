import { moment } from "obsidian";

// Simple translation system for File2QuickNote.
// Obsidian stores the user's language preference; we detect it via moment.locale().

type SupportedLanguage = "de" | "en";

interface Translations {
  createQuickNote: string;
  openQuickNote: string;
  invalidActiveFile: string;
  unsupportedPane: string;
  fileLink: (fileName: string) => string;
  directoryBlockingError: (path: string) => string;
  failureNotice: (details: string) => string;
  noteExistsTitle: string;
  noteExistsMessage: (fileName: string) => string;
  openButton: string;
}

const de: Translations = {
  createQuickNote: "QuickNote erstellen",
  openQuickNote: "QuickNote für aktive Datei öffnen",
  invalidActiveFile: "File2QuickNote: Bitte eine Nicht-Markdown-Datei im Hauptbereich öffnen und auswählen.",
  unsupportedPane: "Der gewünschte Notiz-Tab konnte nicht im Zielbereich geöffnet werden.",
  fileLink: (fileName) => `Datei öffnen: ${fileName}`,
  directoryBlockingError: (path) =>
    `Ein Ordner mit dem gleichen Namen blockiert den Notiz-Pfad "${path}". Bitte umbenennen oder löschen.`,
  failureNotice: (details) => `File2QuickNote: Notiz konnte nicht erstellt oder geöffnet werden. ${details}`,
  noteExistsTitle: "Notiz existiert bereits",
  noteExistsMessage: (fileName) => `Die Notiz zu "${fileName}" existiert bereits.`,
  openButton: "Öffnen",
};

const en: Translations = {
  createQuickNote: "Create QuickNote",
  openQuickNote: "Open QuickNote for active file",
  invalidActiveFile: "File2QuickNote: Select an open non-Markdown file in the main workspace.",
  unsupportedPane: "Could not open the note tab in the target pane.",
  fileLink: (fileName) => `Open file: ${fileName}`,
  directoryBlockingError: (path) =>
    `A directory with the same name is blocking the note path "${path}". Rename or remove it first.`,
  failureNotice: (details) => `File2QuickNote: Could not create or open the note. ${details}`,
  noteExistsTitle: "Note already exists",
  noteExistsMessage: (fileName) => `The note for "${fileName}" already exists.`,
  openButton: "Open",
};

function detectLanguage(): SupportedLanguage {
  // Obsidian uses moment.locale() to track the user's language setting.
  // Extract the language code (e.g., "de" from "de-DE").
  const locale = moment.locale();
  const langCode = locale.split("-")[0];
  return langCode === "de" ? "de" : "en";
}

export function getTranslations(): Translations {
  const lang = detectLanguage();
  return lang === "de" ? de : en;
}
