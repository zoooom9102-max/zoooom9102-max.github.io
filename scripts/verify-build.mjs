import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const subsite = path.join(site, "work", "evaluation-labeling");

const requiredFiles = [
  path.join(site, "index.html"),
  path.join(site, "404.html"),
  path.join(site, ".nojekyll"),
  path.join(site, "media", "eval-method-cover.png"),
  path.join(site, "media", "game-cg-montage.webm"),
  path.join(subsite, "index.html"),
  path.join(subsite, "404.html"),
];

await Promise.all(requiredFiles.map((file) => access(file)));

const mainHtml = await readFile(path.join(site, "index.html"), "utf8");
const subsiteHtml = await readFile(path.join(subsite, "index.html"), "utf8");

if (!mainHtml.includes('/assets/')) {
  throw new Error("Main-site asset prefix is missing.");
}

if (!subsiteHtml.includes('/work/evaluation-labeling/assets/')) {
  throw new Error("Subsite asset prefix is incorrect.");
}

const contentSource = await readFile(
  path.join(root, "apps", "evaluation-labeling", "app", "data", "content.ts"),
  "utf8",
);
const mediaReferences = [
  ...new Set([...contentSource.matchAll(/["'](\/media\/[^"']+)["']/g)].map((match) => match[1])),
];
const missingMedia = [];

for (const reference of mediaReferences) {
  try {
    await access(path.join(subsite, reference.slice(1)));
  } catch {
    missingMedia.push(reference);
  }
}

if (missingMedia.length > 0) {
  throw new Error(`Missing subsite media:\n${missingMedia.join("\n")}`);
}

let largestFile = { file: "", size: 0 };
let fileCount = 0;

async function inspectDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectDirectory(target);
      continue;
    }
    const details = await stat(target);
    fileCount += 1;
    if (details.size > largestFile.size) largestFile = { file: target, size: details.size };
    if (details.size >= 100 * 1024 * 1024) {
      throw new Error(`File exceeds GitHub's 100 MiB limit: ${target}`);
    }
  }
}

await inspectDirectory(site);

console.log(`Verified ${fileCount} deployable files and ${mediaReferences.length} subsite media references.`);
console.log(
  `Largest file: ${path.relative(root, largestFile.file)} (${(largestFile.size / 1024 / 1024).toFixed(2)} MiB).`,
);
