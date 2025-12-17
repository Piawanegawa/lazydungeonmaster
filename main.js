var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => LazyDungeonMasterPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/openrouter.js
var import_obsidian = require("obsidian");
var OpenRouterClient = class {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "") || "";
    this.apiKey = apiKey || "";
  }
  async createChatCompletion({ model, messages }) {
    if (!this.apiKey) {
      const message = "OpenRouter API key is not set.";
      console.error(`[OpenRouter] ${message}`);
      new import_obsidian.Notice(message);
      throw new Error(message);
    }
    const url = `${this.baseUrl}/chat/completions`;
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages
        })
      });
      if (response.status < 200 || response.status >= 300) {
        const snippet = (response.text || "").slice(0, 200) || "No response body";
        const message = `OpenRouter error ${response.status}: ${snippet}`;
        console.error(`[OpenRouter] ${message}`);
        new import_obsidian.Notice(message);
        throw new Error(message);
      }
      return response.json ?? JSON.parse(response.text || "{}");
    } catch (error) {
      const message = `OpenRouter request failed: ${error?.message || error}`;
      console.error(`[OpenRouter] ${message}`, error);
      new import_obsidian.Notice(message);
      throw error;
    }
  }
};

// src/main.js
var TEST_COMMAND_ID = "lazy-dm-test-openrouter";
var SCAN_COMMAND_ID = "lazy-dm-scan-folder";
var PREP_COMMAND_ID = "lazy-dm-generate-prep-2-step";
var ANNOTATE_GM_ZONES_COMMAND_ID = "lazy-dm-annotate-gm-zones";
var OPEN_GM_ZONES_COMMAND_ID = "lazy-dm-open-gm-zones";
var MAX_FILE_BYTES = 8 * 1024 * 1024;
var DEFAULT_SETTINGS = {
  openrouterApiKey: "",
  extractorModel: "z-ai/glm-4.6v",
  synthesizerModel: "deepseek/deepseek-v3.2",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  lastGmZonesPath: ""
};
var LazyDungeonMasterPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LazyDMSettingsTab(this.app, this));
    this.addCommand({
      id: TEST_COMMAND_ID,
      name: "Lazy DM: Test OpenRouter",
      callback: () => this.testOpenRouter()
    });
    this.addCommand({
      id: SCAN_COMMAND_ID,
      name: "Lazy DM: Scan Folder",
      callback: () => this.scanFolderAndAppend()
    });
    this.addCommand({
      id: PREP_COMMAND_ID,
      name: "Lazy DM: Generate Prep (2-step)",
      callback: () => this.generatePrepTwoStep()
    });
    this.addCommand({
      id: ANNOTATE_GM_ZONES_COMMAND_ID,
      name: "Lazy DM: Annotate Map (GM zones)",
      callback: () => this.annotateGmZones()
    });
    this.addCommand({
      id: OPEN_GM_ZONES_COMMAND_ID,
      name: "Lazy DM: Open GM Zones Map",
      callback: () => this.openLastGmZonesMap()
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
      new import_obsidian2.Notice("Set the OpenRouter API key in settings first.");
      return;
    }
    const client = new OpenRouterClient({
      baseUrl: openrouterBaseUrl,
      apiKey: openrouterApiKey
    });
    try {
      const response = await client.createChatCompletion({
        model: synthesizerModel,
        messages: [
          {
            role: "user",
            content: "Reply with a short confirmation that OpenRouter is reachable."
          }
        ]
      });
      const content = response?.choices?.[0]?.message?.content || "Received a response from OpenRouter.";
      new import_obsidian2.Notice(`OpenRouter test succeeded: ${content}`.slice(0, 200));
    } catch (error) {
      console.error("OpenRouter test failed", error);
      new import_obsidian2.Notice("OpenRouter test failed. Check console for details.");
    }
  }
  buildFolderSummary(folder) {
    const files = folder?.children?.filter((item) => item instanceof import_obsidian2.TFile) || [];
    const imagePattern = /\.(png|jpe?g|webp)$/i;
    const playerImagePattern = /_player\.(png|jpe?g|webp)$/i;
    const images = files.filter((file) => imagePattern.test(file.name));
    const playerImages = images.filter((file) => playerImagePattern.test(file.name));
    const selectedMaps = (playerImages.length ? playerImages : images).map((file) => ({
      path: file.path,
      name: file.basename
    }));
    const pcs = files.filter((file) => /\.pdf$/i.test(file.name)).map((file) => ({ path: file.path, name: file.basename }));
    return {
      folderPath: folder?.path || "",
      maps: selectedMaps,
      pcs
    };
  }
  async scanFolderAndAppend() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian2.Notice("Open a note to scan its folder.");
      return;
    }
    const folder = activeFile.parent;
    if (!folder) {
      new import_obsidian2.Notice("Could not determine the folder for the current note.");
      return;
    }
    const summary = this.buildFolderSummary(folder);
    const jsonBlock = `

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\``;
    try {
      await this.app.vault.append(activeFile, jsonBlock);
      new import_obsidian2.Notice("Folder summary appended to the current note.");
    } catch (error) {
      console.error("Failed to append folder summary", error);
      new import_obsidian2.Notice("Failed to append folder summary. Check console for details.");
    }
  }
  async loadFileAsDataUrl(file) {
    if (!file) {
      const message = "No file provided to load as data URL.";
      console.error(message);
      new import_obsidian2.Notice(message);
      return null;
    }
    const extension = (file.extension || file.name?.split(".").pop() || "").toLowerCase();
    const isImage = /^(png|jpe?g|webp)$/.test(extension);
    const isPdf = extension === "pdf";
    if (!isImage && !isPdf) {
      const message = `Unsupported file type: ${extension || "unknown"}.`;
      console.error(message, file.path || "(no path)");
      new import_obsidian2.Notice(message);
      return null;
    }
    try {
      const binary = await this.app.vault.readBinary(file);
      const byteLength = binary?.byteLength || binary?.length || 0;
      if (byteLength > MAX_FILE_BYTES) {
        const sizeMb = (byteLength / (1024 * 1024)).toFixed(1);
        const maxMb = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(1);
        const message = `File is too large to load (${sizeMb} MB). Please reduce the size below ${maxMb} MB.`;
        console.warn(message, file.path || "(no path)");
        new import_obsidian2.Notice(message);
        return null;
      }
      const base64 = Buffer.from(binary).toString("base64");
      const mimeType = isPdf ? "application/pdf" : `image/${extension === "jpg" ? "jpeg" : extension}`;
      const dataUrl = `data:${mimeType};base64,${base64}`;
      if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
        console.warn("Data URL prefix mismatch", { mimeType, dataUrl: dataUrl.slice(0, 40) });
      }
      return dataUrl;
    } catch (error) {
      const message = `Failed to load file as data URL: ${file.path || file.name}.`;
      console.error(message, error);
      new import_obsidian2.Notice(message);
      return null;
    }
  }
  stripJsonFences(text) {
    if (!text) return "";
    const fencePattern = /^```(?:json)?\s*[\r\n]?|```$/g;
    return text.replace(fencePattern, "").trim();
  }
  parseJsonContent(content) {
    if (!content) return null;
    try {
      return JSON.parse(this.stripJsonFences(content));
    } catch (error) {
      console.warn("Failed to parse JSON content", error, content?.slice?.(0, 200));
      return null;
    }
  }
  async loadAssetsForFolder(folder) {
    const summary = this.buildFolderSummary(folder);
    const maps = [];
    const pcs = [];
    for (const map of summary.maps) {
      const vaultFile = this.app.vault.getAbstractFileByPath(map.path);
      const dataUrl = await this.loadFileAsDataUrl(vaultFile);
      if (dataUrl) {
        maps.push({ ...map, dataUrl });
      }
    }
    for (const pc of summary.pcs) {
      const vaultFile = this.app.vault.getAbstractFileByPath(pc.path);
      const dataUrl = await this.loadFileAsDataUrl(vaultFile);
      if (dataUrl) {
        pcs.push({ ...pc, dataUrl });
      }
    }
    return { maps, pcs, folderPath: summary.folderPath };
  }
  async pickMapFromFolder(folder) {
    const summary = this.buildFolderSummary(folder);
    if (!summary.maps.length) {
      new import_obsidian2.Notice("No maps detected in the current folder.");
      return null;
    }
    const selector = new MapSelectModal(this.app, summary.maps);
    const selection = await selector.openAndGetSelection();
    if (!selection) {
      new import_obsidian2.Notice("Map selection cancelled.");
      return null;
    }
    const file = this.app.vault.getAbstractFileByPath(selection.path);
    if (!(file instanceof import_obsidian2.TFile)) {
      new import_obsidian2.Notice("Selected map could not be loaded.");
      return null;
    }
    return file;
  }
  async annotateGmZones() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian2.Notice("Open a note to choose a map from its folder.");
      return;
    }
    const folder = activeFile.parent;
    if (!folder) {
      new import_obsidian2.Notice("Could not determine the folder for the current note.");
      return;
    }
    const mapFile = await this.pickMapFromFolder(folder);
    if (!mapFile) {
      return;
    }
    const dataUrl = await this.loadFileAsDataUrl(mapFile);
    if (!dataUrl) {
      return;
    }
    const modal = new GmZoneModal(this.app, this, mapFile, dataUrl);
    modal.open();
  }
  async openLastGmZonesMap() {
    const lastPath = this.settings.lastGmZonesPath;
    if (!lastPath) {
      new import_obsidian2.Notice("No GM zones map has been generated yet.");
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(lastPath);
    if (!(file instanceof import_obsidian2.TFile)) {
      new import_obsidian2.Notice("Stored GM zones map could not be found.");
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }
  buildExtractorMessages({ maps, pcs }) {
    const intro = "Extract structured prep details from the provided maps and party sheets. Reply with STRICT JSON only.";
    const schema = `The JSON must follow this structure:
{
  "maps": [
    {
      "name": "Name of the map (prefer the file name)",
      "file": "file name",
      "zones": [
        { "zoneId": "A-1", "title": "Short title", "summary": "1-2 sentence summary" }
      ]
    }
  ],
  "zone_descriptions": [
    { "zoneId": "A-1", "details": "Longer description including terrain, clues, secrets" }
  ],
  "connections": [
    { "from": "A-1", "to": "A-2", "note": "How they connect; include cross-map leads" }
  ],
  "party_summary": {
    "roles": "Party composition and roles",
    "key_abilities": "Spells, maneuvers, notable items",
    "weak_saves": "Notable weak defenses",
    "senses": "Perception or sensory advantages"
  },
  "transitions": [
    { "fromMap": "Map file name", "toMap": "Other map file", "hook": "Suggested transition scene" }
  ]
}`;
    const contentBlocks = [
      { type: "text", text: `${intro}
${schema}
Use zoneId prefixes like A-, B- per map.` }
    ];
    maps.forEach((map, index) => {
      contentBlocks.push({ type: "text", text: `Map ${index + 1}: ${map.name} (${map.path || map.file})` });
      contentBlocks.push({
        type: "image_url",
        image_url: { url: map.dataUrl, detail: "high" }
      });
    });
    pcs.forEach((pc, index) => {
      contentBlocks.push({ type: "text", text: `Character PDF ${index + 1}: ${pc.name}` });
      contentBlocks.push({ type: "input_text", text: pc.dataUrl });
    });
    return [
      {
        role: "system",
        content: "You are an expert prep extractor. Respond with valid JSON only. Do not wrap responses in markdown fences."
      },
      { role: "user", content: contentBlocks }
    ];
  }
  buildSynthesizerMessages({ extractedJson, maps, pcs }) {
    const filenames = {
      maps: maps.map((map) => map.path || map.name),
      pcs: pcs.map((pc) => pc.path || pc.name)
    };
    const instructions = `Erzeuge ein Markdown-Prep-Dokument auf Deutsch. Nutze NUR die gelieferten extrahierten Daten. Anforderungen:
- F\xFCge pro Karte zwei Links hinzu: "player" (Spieleransicht) und "gm_zones" (Zonenreferenz, auch wenn der Link nur ein Platzhalter ist).
- Verkn\xFCpfe Szenen klar mit den jeweiligen zoneId aus den extrahierten Daten.
- Baue einen starken Auftakt (Strong Start).
- Liste 10 Geheimnisse & Hinweise mit vorgeschlagenen Drop-Zonen (zoneId).
- Baue Begegnungen, die auf die Party zugeschnitten sind (Nutze party_summary).
- Schlage Belohnungen vor.
- F\xFCge \xDCbergangsszenen zwischen Karten basierend auf transitions hinzu.`;
    return [
      {
        role: "system",
        content: instructions
      },
      {
        role: "user",
        content: `Dateinamen: ${JSON.stringify(filenames, null, 2)}
Extrahierte Daten:
${JSON.stringify(
          extractedJson,
          null,
          2
        )}`
      }
    ];
  }
  async requestExtractor(payload) {
    const { extractorModel, openrouterApiKey, openrouterBaseUrl } = this.settings;
    const client = new OpenRouterClient({
      baseUrl: openrouterBaseUrl,
      apiKey: openrouterApiKey
    });
    let lastContent = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await client.createChatCompletion({
        model: extractorModel,
        messages: payload
      });
      lastContent = response?.choices?.[0]?.message?.content || "";
      const parsed = this.parseJsonContent(lastContent);
      if (parsed) {
        return parsed;
      }
      if (attempt === 1) {
        new import_obsidian2.Notice("Extractor returned invalid JSON. Retrying once...");
      }
    }
    throw new Error("Extractor failed to produce valid JSON after retry.");
  }
  async requestSynthesizer(payload) {
    const { synthesizerModel, openrouterApiKey, openrouterBaseUrl } = this.settings;
    const client = new OpenRouterClient({
      baseUrl: openrouterBaseUrl,
      apiKey: openrouterApiKey
    });
    const response = await client.createChatCompletion({
      model: synthesizerModel,
      messages: payload
    });
    return response?.choices?.[0]?.message?.content || "";
  }
  async updateNoteWithPrep(note, markdown) {
    const startMarker = "<!-- LAZY_DM_START -->";
    const endMarker = "<!-- LAZY_DM_END -->";
    const current = await this.app.vault.read(note);
    const startIndex = current.indexOf(startMarker);
    const endIndex = current.indexOf(endMarker);
    let nextContent;
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const before = current.slice(0, startIndex + startMarker.length);
      const after = current.slice(endIndex);
      nextContent = `${before}

${markdown.trim()}

${after}`;
    } else {
      nextContent = `${current.trim()}

${startMarker}
${markdown.trim()}
${endMarker}
`;
    }
    await this.app.vault.modify(note, nextContent);
  }
  async generatePrepTwoStep() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian2.Notice("Open a note to generate prep.");
      return;
    }
    const folder = activeFile.parent;
    if (!folder) {
      new import_obsidian2.Notice("Could not determine the folder for the current note.");
      return;
    }
    try {
      const assets = await this.loadAssetsForFolder(folder);
      if (!assets.maps.length && !assets.pcs.length) {
        new import_obsidian2.Notice("No maps or character PDFs found in the folder.");
        return;
      }
      new import_obsidian2.Notice("Extracting structured prep from assets...");
      const extractorMessages = this.buildExtractorMessages(assets);
      const extracted = await this.requestExtractor(extractorMessages);
      new import_obsidian2.Notice("Synthesizing final prep in German...");
      const synthesizerMessages = this.buildSynthesizerMessages({ extractedJson: extracted, ...assets });
      const markdown = await this.requestSynthesizer(synthesizerMessages);
      await this.updateNoteWithPrep(activeFile, markdown);
      new import_obsidian2.Notice("Lazy DM prep inserted into the note.");
    } catch (error) {
      console.error("Lazy DM prep generation failed", error);
      new import_obsidian2.Notice("Prep generation failed. Check console for details.");
    }
  }
};
var MapSelectModal = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, maps) {
    super(app);
    this.maps = maps;
    this.promise = new Promise((resolve) => {
      this.resolver = resolve;
    });
    this.chosen = false;
  }
  getItems() {
    return this.maps;
  }
  getItemText(item) {
    return item?.name || item?.path || "map";
  }
  onChooseItem(item) {
    this.chosen = true;
    this.resolver(item);
  }
  onClose() {
    if (!this.chosen) {
      this.resolver(null);
    }
  }
  async openAndGetSelection() {
    this.open();
    return this.promise;
  }
};
var GmZoneModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, mapFile, dataUrl) {
    super(app);
    this.plugin = plugin;
    this.mapFile = mapFile;
    this.dataUrl = dataUrl;
    this.zoneCount = 6;
    this.zonePrefix = "Z";
    this.customIds = "";
    this.points = [];
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Annotate GM Zones: ${this.mapFile.basename}` });
    contentEl.createEl("p", {
      text: "Enter how many zones you want, or paste custom zone IDs. Click the map in order to place labels."
    });
    const controls = contentEl.createDiv({ cls: "lazy-gm-zone-controls" });
    controls.createEl("label", { text: "Zone count" });
    this.countInput = controls.createEl("input", { type: "number" });
    this.countInput.value = String(this.zoneCount);
    this.countInput.min = "1";
    this.countInput.addEventListener("change", () => this.handleConfigChange());
    controls.createEl("label", { text: "Default prefix" });
    this.prefixInput = controls.createEl("input", { type: "text" });
    this.prefixInput.value = this.zonePrefix;
    this.prefixInput.addEventListener("input", () => this.handleConfigChange());
    controls.createEl("label", { text: "Custom zone IDs (comma or newline separated)" });
    this.idsInput = controls.createEl("textarea");
    this.idsInput.placeholder = "A-Z1, A-Z2, ...";
    this.idsInput.addEventListener("input", () => this.handleConfigChange());
    this.statusEl = contentEl.createEl("div", { cls: "lazy-gm-zone-status" });
    this.mapContainer = contentEl.createDiv({ cls: "lazy-gm-zone-map" });
    this.mapContainer.style.position = "relative";
    this.mapContainer.style.maxHeight = "60vh";
    this.mapContainer.style.overflow = "auto";
    const imageWrapper = this.mapContainer.createDiv({ cls: "lazy-gm-zone-map-wrapper" });
    imageWrapper.style.position = "relative";
    this.imageEl = imageWrapper.createEl("img", {
      attr: { src: this.dataUrl, alt: "GM map" }
    });
    this.imageEl.style.display = "block";
    this.imageEl.style.width = "100%";
    this.imageEl.style.height = "auto";
    this.markerLayer = imageWrapper.createDiv({ cls: "lazy-gm-zone-markers" });
    this.markerLayer.style.position = "absolute";
    this.markerLayer.style.left = "0";
    this.markerLayer.style.top = "0";
    this.markerLayer.style.width = "100%";
    this.markerLayer.style.height = "100%";
    this.markerLayer.style.pointerEvents = "none";
    imageWrapper.addEventListener("click", (event) => this.handleMapClick(event));
    const actions = contentEl.createDiv({ cls: "lazy-gm-zone-actions" });
    const clearButton = actions.createEl("button", { text: "Clear markers" });
    clearButton.addEventListener("click", () => this.resetMarkers());
    this.saveButton = actions.createEl("button", { text: "Save labeled map" });
    this.saveButton.addEventListener("click", () => this.saveLabeledMap());
    this.updateStatus();
  }
  handleConfigChange() {
    this.zoneCount = Math.max(1, parseInt(this.countInput.value, 10) || 1);
    this.zonePrefix = this.prefixInput.value?.trim() || "Z";
    this.customIds = this.idsInput.value || "";
    this.resetMarkers();
    this.updateStatus();
  }
  getZoneIds() {
    const provided = (this.customIds || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    if (provided.length) {
      return provided;
    }
    return Array.from({ length: this.zoneCount }, (_, index) => `${this.zonePrefix}${index + 1}`);
  }
  resetMarkers() {
    this.points = [];
    if (this.markerLayer) {
      this.markerLayer.empty();
    }
    this.updateStatus();
  }
  updateStatus() {
    const zoneIds = this.getZoneIds();
    const nextIndex = this.points.length;
    const remaining = zoneIds.length - nextIndex;
    const nextLabel = zoneIds[nextIndex] || "All placed";
    this.statusEl.setText(`Next label: ${nextLabel} | Remaining: ${Math.max(0, remaining)}`);
    if (this.saveButton) {
      this.saveButton.disabled = this.points.length !== zoneIds.length || !zoneIds.length;
    }
  }
  handleMapClick(event) {
    const zoneIds = this.getZoneIds();
    const nextIndex = this.points.length;
    if (!zoneIds.length) {
      new import_obsidian2.Notice("Add at least one zone.");
      return;
    }
    if (nextIndex >= zoneIds.length) {
      new import_obsidian2.Notice("All zones placed. Clear markers to start over.");
      return;
    }
    const rect = this.imageEl.getBoundingClientRect();
    const xRel = (event.clientX - rect.left) / rect.width;
    const yRel = (event.clientY - rect.top) / rect.height;
    this.points.push({ id: zoneIds[nextIndex], x: xRel, y: yRel });
    this.renderMarker(zoneIds[nextIndex], xRel, yRel);
    this.updateStatus();
  }
  renderMarker(label, xRel, yRel) {
    const marker = this.markerLayer.createDiv({ cls: "lazy-gm-zone-marker" });
    marker.style.position = "absolute";
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.left = `${(xRel * 100).toFixed(4)}%`;
    marker.style.top = `${(yRel * 100).toFixed(4)}%`;
    marker.style.background = "rgba(0, 0, 0, 0.75)";
    marker.style.color = "white";
    marker.style.padding = "4px 8px";
    marker.style.borderRadius = "999px";
    marker.style.fontWeight = "bold";
    marker.style.fontSize = "12px";
    marker.style.pointerEvents = "none";
    marker.setText(label);
  }
  async saveLabeledMap() {
    const zoneIds = this.getZoneIds();
    if (this.points.length !== zoneIds.length) {
      new import_obsidian2.Notice("Place all zones before saving.");
      return;
    }
    try {
      const labeledData = await this.renderLabeledImage();
      const outputName = `${this.mapFile.basename}_gm_zones.png`;
      const basePath = this.mapFile.parent?.path || "";
      const outputPath = basePath ? `${basePath}/${outputName}` : outputName;
      const existing = this.app.vault.getAbstractFileByPath(outputPath);
      const binary = Buffer.from(labeledData, "base64");
      if (existing instanceof import_obsidian2.TFile) {
        await this.app.vault.modifyBinary(existing, binary);
      } else {
        await this.app.vault.createBinary(outputPath, binary);
      }
      this.plugin.settings.lastGmZonesPath = outputPath;
      await this.plugin.saveSettings();
      new import_obsidian2.Notice(`Saved GM zones map to ${outputName}.`);
      this.close();
    } catch (error) {
      console.error("Failed to render GM zones map", error);
      new import_obsidian2.Notice("Failed to create GM zones map. Check console for details.");
    }
  }
  async renderLabeledImage() {
    const zoneIds = this.getZoneIds();
    const imageElement = await this.loadImageElement();
    const canvas = document.createElement("canvas");
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageElement, 0, 0);
    const fontSize = Math.max(18, Math.round(canvas.width * 0.02));
    const radius = Math.max(18, Math.round(canvas.width * 0.02));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.points.forEach((point, index) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      const label = point.id || zoneIds[index] || `Z${index + 1}`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillText(label, x, y);
    });
    const pngDataUrl = canvas.toDataURL("image/png");
    return pngDataUrl.split(",")[1];
  }
  loadImageElement() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (error) => reject(error);
      img.src = this.dataUrl;
    });
  }
};
var LazyDMSettingsTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Lazy Dungeon Master" });
    new import_obsidian2.Setting(containerEl).setName("OpenRouter API Key").setDesc("Stored locally. Required for OpenRouter requests.").addText((text) => {
      text.setPlaceholder("sk-or-...").setValue(this.plugin.settings.openrouterApiKey).onChange(async (value) => {
        this.plugin.settings.openrouterApiKey = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian2.Setting(containerEl).setName("Extractor model").setDesc("Model used for extracting details from prompts.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.extractorModel).setValue(this.plugin.settings.extractorModel).onChange(async (value) => {
        this.plugin.settings.extractorModel = value || DEFAULT_SETTINGS.extractorModel;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Synthesizer model").setDesc("Model used for creating narrative content.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.synthesizerModel).setValue(this.plugin.settings.synthesizerModel).onChange(async (value) => {
        this.plugin.settings.synthesizerModel = value || DEFAULT_SETTINGS.synthesizerModel;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("OpenRouter base URL").setDesc("Base API URL for OpenRouter requests.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.openrouterBaseUrl).setValue(this.plugin.settings.openrouterBaseUrl).onChange(async (value) => {
        this.plugin.settings.openrouterBaseUrl = value || DEFAULT_SETTINGS.openrouterBaseUrl;
        await this.plugin.saveSettings();
      })
    );
  }
};
