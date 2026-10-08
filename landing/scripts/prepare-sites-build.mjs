#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

for (const file of [index, worker]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
// The Sites hosting config is optional: without it the Vite build (which Vercel deploys) must still succeed.
if (existsSync(hosting)) {
  mkdirSync(path.join(dist, ".openai"), { recursive: true });
  copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
  console.log("Prepared Sites build: dist/server/index.js and dist/.openai/hosting.json");
} else {
  console.log("Prepared dist/server/index.js. No .openai/hosting.json, so the Sites bundle is incomplete.");
}
