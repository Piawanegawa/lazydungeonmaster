import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { OpenRouterClient } from "./openrouter";

const TEST_COMMAND_ID = "lazy-dm-test-openrouter";

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
