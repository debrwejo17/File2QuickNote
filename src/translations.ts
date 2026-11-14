import { moment } from "obsidian";

// Simple translation system for File2QuickNote.
// Obsidian stores the user's language preference; we detect it via moment.locale().

type SupportedLanguage = "de" | "en";

interface Translations {
  createQuickNote: string;
  fileLink: (fileName: string) => string;
  directoryBlockingError: (path: string) => string;
  failureNotice: (details: string) => string;
  noteExistsTitle: string;
  noteExistsMessage: (fileName: string) => string;
  openButton: string;
}

const de: Translations = {
  createQuickNote: "QuickNote erstellen",
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
