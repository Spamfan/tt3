// Tank Tycoon (prototype 3) - js-manifest.js (v0.0.1)
// Alphabetical Repository Manifest & Version Floor Registry

export const MODULE_VERSION = "v0.0.1";
export const APP_TITLE = "Tank Tycoon (prototype 3)";
export const APP_SHORT_CODE = "tt3";
export const APP_VERSION = "v0.0.1";

export const MANIFEST_DATA = Object.freeze([
  { name: "index.html", version: "v0.0.1", type: "shell" },
  { name: "js-engine-physics.js", version: "v0.0.1", type: "engine" },
  { name: "js-engine-render.js", version: "v0.0.1", type: "engine" },
  { name: "js-engine-world.js", version: "v0.0.1", type: "engine" },
  { name: "js-main.js", version: "v0.0.1", type: "core" },
  { name: "js-manifest.js", version: "v0.0.1", type: "core" },
  { name: "js-state-player.js", version: "v0.0.1", type: "state" },
  { name: "js-state-storage.js", version: "v0.0.1", type: "state" },
  { name: "js-ui-controller.js", version: "v0.0.1", type: "ui" },
  { name: "md-spec-physics.md", version: "V1", type: "spec" },
  { name: "md-spec-project.md", version: "V4", type: "spec" },
  { name: "md-spec-render.md", version: "V1", type: "spec" },
  { name: "md-spec-storage.md", version: "V1", type: "spec" },
  { name: "md-spec-tank.md", version: "V1", type: "spec" },
  { name: "md-spec-ui.md", version: "V1", type: "spec" },
  { name: "md-spec-world.md", version: "V1", type: "spec" },
  { name: "styles.css", version: "v0.0.1", type: "style" }
]);

export function getManifestData() {
  return [...MANIFEST_DATA].sort((a, b) => a.name.localeCompare(b.name));
}
