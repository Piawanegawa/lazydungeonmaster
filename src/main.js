import { Notice, Plugin } from "obsidian";

const COMMAND_ID = "lazy-dm-hello";

export default class LazyDungeonMasterPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: COMMAND_ID,
      name: "Lazy DM: Hello",
      callback: () => {
        new Notice("Hello from Lazy Dungeon Master!");
      },
    });
  }
}
