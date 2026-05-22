import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = new URL("../dist/", import.meta.url);
const indexPath = new URL("index.html", distDir);
const indexHtml = readFileSync(indexPath, "utf8");

const scriptMatch = indexHtml.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const styleMatch = indexHtml.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error("Could not find built script and stylesheet in dist/index.html.");
}

const scriptPath = new URL(scriptMatch[1], indexPath);
const stylePath = new URL(styleMatch[1], indexPath);
const assetDir = dirname(fileURLToPath(stylePath));

let css = readFileSync(stylePath, "utf8");
css = css.replace(/url\("\.\/([^"]+\.woff2)"\)/g, (_match, fileName) => {
  const fontPath = join(assetDir, fileName);
  const font = readFileSync(fontPath);
  return `url("data:font/woff2;base64,${font.toString("base64")}")`;
});

const js = readFileSync(fileURLToPath(scriptPath), "utf8");

const standalone = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mortgage Decision Helper</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${js}
    </script>
  </body>
</html>
`;

const outPath = new URL("mortgage-helper-standalone.html", distDir);
writeFileSync(outPath, standalone);
writeFileSync(indexPath, standalone);
console.log(`Created ${basename(outPath.pathname)}`);
console.log("Replaced index.html with standalone export");
