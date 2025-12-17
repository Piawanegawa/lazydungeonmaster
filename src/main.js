import { Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { OpenRouterClient } from "./openrouter";

const TEST_COMMAND_ID = "lazy-dm-test-openrouter";
const SCAN_COMMAND_ID = "lazy-dm-scan-folder";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB guardrail to avoid crashing on huge attachments.

const DEFAULT_SETTINGS = {
  openrouterApiKey: "",
  extractorModel: "z-ai/glm-4.6v",
  synthesizerModel: "deepseek/deepseek-v3.2",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
};

export default class LazyDungeonMasterPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addSettingTab(new LazyDMSettingsTab(this.app, this));

    this.addCommand({
      id: TEST_COMMAND_ID,
      name: "Lazy DM: Test OpenRouter",
      callback: () => this.testOpenRouter(),
    });

    this.addCommand({
      id: SCAN_COMMAND_ID,
      name: "Lazy DM: Scan Folder",
      callback: () => this.scanFolderAndAppend(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async testOpenRouter() {
    const { openrouterApiKey, openrouterBaseUrl, synthesizerModel } = this.settings;

    if (!openrouterApiKey) {
      new Notice("Set the OpenRouter API key in settings first.");
      return;
    }

    const client = new OpenRouterClient({
      baseUrl: openrouterBaseUrl,
      apiKey: openrouterApiKey,
    });

    try {
      const response = await client.createChatCompletion({
        model: synthesizerModel,
        messages: [
          {
            role: "user",
            content: "Reply with a short confirmation that OpenRouter is reachable.",
          },
        ],
      });

      const content =
        response?.choices?.[0]?.message?.content || "Received a response from OpenRouter.";
      new Notice(`OpenRouter test succeeded: ${content}`.slice(0, 200));
    } catch (error) {
      console.error("OpenRouter test failed", error);
      new Notice("OpenRouter test failed. Check console for details.");
    }
  }

  buildFolderSummary(folder) {
    const files = folder?.children?.filter((item) => item instanceof TFile) || [];

    const imagePattern = /\.(png|jpe?g|webp)$/i;
    const playerImagePattern = /_player\.(png|jpe?g|webp)$/i;

    const images = files.filter((file) => imagePattern.test(file.name));
    const playerImages = images.filter((file) => playerImagePattern.test(file.name));
    const selectedMaps = (playerImages.length ? playerImages : images).map((file) => ({
      path: file.path,
      name: file.basename,
    }));

    const pcs = files
      .filter((file) => /\.pdf$/i.test(file.name))
      .map((file) => ({ path: file.path, name: file.basename }));

    return {
      folderPath: folder?.path || "",
      maps: selectedMaps,
      pcs,
    };
  }

  async scanFolderAndAppend() {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      new Notice("Open a note to scan its folder.");
      return;
    }

    const folder = activeFile.parent;

    if (!folder) {
      new Notice("Could not determine the folder for the current note.");
      return;
    }

    const summary = this.buildFolderSummary(folder);
    const jsonBlock = `\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;

    try {
      await this.app.vault.append(activeFile, jsonBlock);
      new Notice("Folder summary appended to the current note.");
    } catch (error) {
      console.error("Failed to append folder summary", error);
      new Notice("Failed to append folder summary. Check console for details.");
    }
  }

  async loadFileAsDataUrl(file) {
    if (!file) {
      const message = "No file provided to load as data URL.";
      console.error(message);
      new Notice(message);
      return null;
    }

    const extension = (file.extension || file.name?.split(".").pop() || "").toLowerCase();
    const isImage = /^(png|jpe?g|webp)$/.test(extension);
    const isPdf = extension === "pdf";
    if (!isImage && !isPdf) {
      const message = `Unsupported file type: ${extension || "unknown"}.`;
      console.error(message, file.path || "(no path)");
      new Notice(message);
      return null;
    }

    try {
      const binary = await this.app.vault.readBinary(file);
      const byteLength = binary?.byteLength || binary?.length || 0;

      if (byteLength > MAX_FILE_BYTES) {
        const sizeMb = (byteLength / (1024 * 1024)).toFixed(1);
        const maxMb = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(1);
        // Smoke check: large files should short-circuit before base64 conversion.
        const message = `File is too large to load (${sizeMb} MB). Please reduce the size below ${maxMb} MB.`;
        console.warn(message, file.path || "(no path)");
        new Notice(message);
        return null;
      }

      const base64 = Buffer.from(binary).toString("base64");
      const mimeType = isPdf ? "application/pdf" : `image/${extension === "jpg" ? "jpeg" : extension}`;
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Smoke check: ensure data URL prefix stays intact for supported files.
      if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
        console.warn("Data URL prefix mismatch", { mimeType, dataUrl: dataUrl.slice(0, 40) });
      }

      return dataUrl;
    } catch (error) {
      const message = `Failed to load file as data URL: ${file.path || file.name}.`;
      console.error(message, error);
      new Notice(message);
      return null;
    }
  }
}

class LazyDMSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Lazy Dungeon Master" });

    new Setting(containerEl)
      .setName("OpenRouter API Key")
      .setDesc("Stored locally. Required for OpenRouter requests.")
      .addText((text) => {
        text
          .setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openrouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openrouterApiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("Extractor model")
      .setDesc("Model used for extracting details from prompts.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.extractorModel)
          .setValue(this.plugin.settings.extractorModel)
          .onChange(async (value) => {
            this.plugin.settings.extractorModel = value || DEFAULT_SETTINGS.extractorModel;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Synthesizer model")
      .setDesc("Model used for creating narrative content.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.synthesizerModel)
          .setValue(this.plugin.settings.synthesizerModel)
          .onChange(async (value) => {
            this.plugin.settings.synthesizerModel = value || DEFAULT_SETTINGS.synthesizerModel;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OpenRouter base URL")
      .setDesc("Base API URL for OpenRouter requests.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.openrouterBaseUrl)
          .setValue(this.plugin.settings.openrouterBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openrouterBaseUrl = value || DEFAULT_SETTINGS.openrouterBaseUrl;
            await this.plugin.saveSettings();
          })
      );
  }
}
