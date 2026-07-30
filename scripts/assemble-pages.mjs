import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, "site");
const portfolioOutput = resolve(repositoryRoot, "apps/portfolio/dist");
const evaluationOutput = resolve(repositoryRoot, "apps/evaluation-labeling/dist");
const evaluationTarget = resolve(outputRoot, "work/evaluation-labeling");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(portfolioOutput, outputRoot, { recursive: true });
await mkdir(evaluationTarget, { recursive: true });
await cp(evaluationOutput, evaluationTarget, { recursive: true });

// GitHub Pages should serve generated asset folders without Jekyll processing.
await writeFile(resolve(outputRoot, ".nojekyll"), "", "utf8");

// GitHub Pages has no server-side SPA rewrite. The custom 404 document boots
// the same React application so valid BrowserRouter URLs still render.
await copyFile(resolve(outputRoot, "index.html"), resolve(outputRoot, "404.html"));
await copyFile(
  resolve(evaluationTarget, "index.html"),
  resolve(evaluationTarget, "404.html"),
);

console.log(`GitHub Pages artifact assembled at ${outputRoot}`);

