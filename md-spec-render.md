# Canvas Rendering Subsystem Specification
### Sub-Spoke Specification: js-engine-render.js
### Version V3

---

### 1. SYSTEM OVERVIEW
The rendering engine provides hardware-accelerated 2D canvas drawing, continuous multi-pass contour terrain rendering (photorealistic curved sand shores and organic lake basins), smooth cinematic camera tracking (0.05 LERP, 10px lookahead), 10% recoil dampening, and grid rendering reserved exclusively for player base slabs.

---

### 2. RENDER CONSTANTS & TOKENS
* `CAMERA_ZOOM = 0.8` (renders 1.25x world area, expanding visible battlefield by 25%).
* `VIEWPORT_BUFFER_CHUNKS = 1` (margin around frustum for seamless scrolling).
* `TRAJECTORY_LENGTH = 230` px (faint white dashed line extending from muzzle).
* `CAMERA_LERP = 0.05` (smooth cinematic position follow).
* `CAMERA_LOOKAHEAD = 10` px (gentle directional lead without sudden snapping).
* Palette Tokens:
  * Background / Canvas: `#12171e`
  * Grass (Muted Military Moss): `#475422`
  * Sand / Beach (Contoured Shore): `#cbb185`
  * Water (Dark Pond Slate): `#182633`
  * Dirt (Basalt Loam): `#635c49`
  * Player Tank Hull / Turret: `#465866` / `#5a6f7e`
  * Enemy Tank Hull / Turret: `#8a7b70` / `#9e8e82`
  * HUD Accent Cyan: `#00f0ff`
  * Vitality Green: `#2ec4b6`
  * Hazard Amber: `#ffb703`
  * Alert Crimson: `#e63946`

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initRenderer(canvasElement)`
* Establishes `CanvasRenderingContext2D` with `imageSmoothingEnabled = false` for sharp vector/pixel styling.
* Resizes canvas to matching device pixel ratio (`window.devicePixelRatio`) to eliminate high-DPI blur on iPhone SE and modern mobile.

#### `renderFrame(renderState, alpha)`
* Master draw routine called by `requestAnimationFrame`.
* Interpolates current and previous physics positions using `alpha` to ensure smooth 144 FPS rendering.

#### `renderWorld(camera, chunks, worldState)`
* Renders continuous non-grid terrain using multi-pass organic contour curves matching realistic reference styling:
  * Pass 1: Photorealistic olive grass background.
  * Pass 2: Natural curved sand contours sampled at continuous elevation thresholds (`elev < 0.43`).
  * Pass 3: Deep navy/slate water lakes nested within sand margins (`elev < 0.34`).
  * Pass 4: Player-placed reinforced concrete and respawn pads snapped to 2x2 grid.

#### `renderTanks(camera, player, enemies)`
* Renders soft elliptical under-chassis drop shadow for realistic visual depth.
* Renders tread tracks, chassis base (rotated to chassis heading), and independent turret (rotated to aim vector).
* Applies recoil displacement offset along barrel axis during firing frames.

#### `renderCombatFX(camera, projectiles, particles)`
* **Trajectory Guide:** Draws faint white dashed line from player turret muzzle terminating with subtle reticle dot.
* **Muzzle Sparks & Casings:** Spawns short-lived spark bursts at muzzle; renders brass shell casings flying perpendicular to barrel with rotational spin and decay.
* **Pickups:** Renders bright green currency badge with glow aura matching realistic reference.
* **Floating Text:** Renders rising damage numbers (`-10 HP`) and scrap notifications (`+1 STEEL`) with alpha fade.

#### `renderPlacementGhost(camera, placementState)`
* When crafting base blocks, draws an aligned 2x2 tank-sized grid box.
* Renders in neon cyan if valid; renders alert red with crosshatch if overlapping water.

#### `renderBaseInteractCue(camera, player, baseBlocks)`
* When player tank is within an active base block, renders a pulsing green/white `+` glyph hovering 32px above the block center.
* Functions as visual cue synchronized with the DOM `.hud-btn-interact` trigger.