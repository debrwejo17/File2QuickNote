import * as esbuild from "esbuild";

const isProduction = process.argv[2] === "production";
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2018",
  outfile: "build/main.js",
  sourcemap: isProduction ? false : "inline",
  minify: isProduction,
  logLevel: "info"
};

if (isProduction) {
  await esbuild.build(options);
} else {
  const context = await esbuild.context(options);
  await context.watch();
}
