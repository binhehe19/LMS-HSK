import { cp, mkdir } from "node:fs/promises";

const source = new URL("../node_modules/tinymce/", import.meta.url);
const target = new URL("../public/tinymce/", import.meta.url);
await mkdir(target, { recursive: true });
for (const asset of ["icons", "models", "plugins", "skins", "themes", "tinymce.min.js"]) {
  await cp(new URL(asset, source), new URL(asset, target), { recursive: true });
}
