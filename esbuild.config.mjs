import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/main.js"],
  bundle: true,
  platform: "node",
  target: "es2018",
  format: "cjs",
  outfile: "main.js",
  external: ["obsidian"],
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching... (Ctrl+C to stop)");
} else {
  await esbuild.build(options);
}
