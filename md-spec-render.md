# Canvas Rendering Subsystem Specification
### Sub-Spoke Specification: js-engine-render.js
### Version v0.0.1

---

### 1. SYSTEM OVERVIEW
The rendering engine provides hardware-accelerated 2D canvas drawing, dynamic camera tracking with look-ahead damping, viewport chunk culling, offscreen tile pattern caching, and visual juice (trajectories, recoil, sparks, ejected casings, and in-world canvas overlays).

---

### 2. RENDER CONSTANTS & TOKENS
* `VIEWPORT_BUFFER_CHUNKS = 1` (margin around frustum for seamless scrolling).
* `TRAJECTORY_LENGTH = 192` px (fading dotted line extending 3–4 tank lengths from muzzle).
* `CAMERA_LERP = 0.08` (smooth position follow).
* `CAMERA_LOOKAHEAD = 45` px (directional lead along tank velocity vector).
* Palette Tokens:
  * Background / Canvas: `#0b0e14`
  * HUD Accent Cyan: `#00f0ff`
  * Vitality Green: `#2ec4b6`
  * Hazard Amber: `#ffb703`
  * Alert Crimson: `#e63946`
  * Ghost Placement Valid: `rgba(0, 240, 255, 0.45)`
  * Ghost Placement Invalid: `rgba(230, 57, 70, 0.45)`

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initRenderer(canvasElement)`
* Establishes `CanvasRenderingContext2D` with `imageSmoothingEnabled = false` for sharp vector/pixel styling.
* Resizes canvas to matching device pixel ratio (`window.devicePixelRatio`) to eliminate high-DPI blur on iPhone SE and modern mobile.

#### `renderFrame(renderState, alpha)`
* Master draw routine called by `requestAnimationFrame`.
* Interpolates current and previous physics positions using `alpha` to ensure smooth 144 FPS rendering.

#### `renderWorld(camera, chunks)`
* Calculates active screen bounding box transformed into world coordinates.
* Draws visible terrain tiles using pre-rendered offscreen canvas pattern tiles.

#### `renderTanks(camera, player, enemies)`
* Renders tread tracks, chassis base (rotated to chassis heading), and independent turret (rotated to aim vector).
* Applies recoil displacement offset along barrel axis during firing frames.

#### `renderCombatFX(camera, projectiles, particles)`
* **Trajectory Guide:** Draws faint dotted line from player turret muzzle extending 3–4 tank lengths, terminating with subtle lead dot.
* **Muzzle Sparks & Casings:** Spawns short-lived spark bursts at muzzle; renders brass shell casings flying perpendicular to barrel with rotational spin and decay.
* **Floating Text:** Renders rising damage numbers (`-10 HP`) and scrap notifications (`+1 STEEL`) with alpha fade.

#### `renderPlacementGhost(camera, placementState)`
* When crafting base blocks, draws an aligned 2x2 tank-sized grid box.
* Renders in neon cyan if valid; renders alert red with crosshatch if overlapping water.

#### `renderBaseInteractCue(camera, player, baseBlocks)`
* When player tank is within an active base block, renders a pulsing green/white `+` glyph hovering 32px above the block center.
* Functions as visual cue synchronized with the DOM `.hud-btn-interact` trigger.