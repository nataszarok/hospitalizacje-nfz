import { rm, rename } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await rename("out", "dist");
console.log("Static site ready in dist/.");
