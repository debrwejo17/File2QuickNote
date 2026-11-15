export class TFile {
  constructor(path) {
    this.path = path;
    this.name = path.split("/").at(-1);
    this.extension = this.name.includes(".") ? this.name.split(".").at(-1) : "";
  }
}

export class WorkspaceTabs {
  constructor(parent) {
    this.parent = parent;
  }
}

export class View {
  constructor(leaf) {
    this.leaf = leaf;
  }
}

export class FileView extends View {
  constructor(leaf, file, rect) {
    super(leaf);
    this.file = file;
    this.containerEl = { getBoundingClientRect: () => rect };
  }
}

export const notices = [];
export class Notice {
  constructor(message) {
    notices.push(message);
  }
}

export class ConfirmationModal {
  static instances = [];
  constructor() {
    this.contentEl = { createDiv: () => ({ setText: () => {} }) };
    ConfirmationModal.instances.push(this);
  }
  addButton(callback) {
    callback({ setButtonText: () => ({ onClick: (click) => { this.confirm = click; } }) });
  }
  addCancelButton() {}
  open() { this.opened = true; }
  close() { this.opened = false; }
}

export class Plugin {
  constructor(app) { this.app = app; }
  registerEvent() {}
  addCommand(command) { this.command = command; }
}

export const moment = { locale: () => "en" };
