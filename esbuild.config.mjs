import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

esbuild
  .build({
    entryPoints: ["src/main.js"],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["obsidian"],
    outfile: "main.js",
    sourcemap: watch,
    watch,
    banner: {
      js: "/* Lazy Dungeon Master - built with esbuild */",
    },
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
