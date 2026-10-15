# UI, HUD & Input Controller Specification
### Sub-Spoke Specification: js-ui-controller.js / styles.css
### Version V1

---

### 1. SYSTEM OVERVIEW
Governs the DOM-based tactical HUD overlay, dual touch-joystick mobile controls, desktop keyboard/mouse listeners, the Halo Reach styled pause menu, fullscreen API integration, and the in-game Alphabetical Repo Manifest modal.

---

### 2. DOM STRUCTURE & SELECTORS
* `.hud-container`: Pointer-events pass-through container over canvas.
* `.hud-top-bar`: Responsive flex row pinned to top edge.
  * `.hud-version`: Discrete `v0.0.1` label at top-left.
  * `.hud-center-cluster`: Centered tactical cluster:
    * `.hud-health-bar`: High-contrast green vitality meter (`100/100`).
    * `.hud-cash`: Real-time formatted currency (`$0.00`).
    * `.hud-btn-inventory`: Tactical SVG pouch button.
  * `.hud-btn-pause`: Top-right pause button (`||`).
* `.hud-btn-interact`: Floating contextual button at bottom-right (primary ergonomic touch trigger; appears on base block entry).
* `.skeleton-box`: Dark carbon wireframe shimmer (`#161b24` to `#222b3a` linear gradient pulse at 1.4s cycle) for modal loading and save hydration.
* `.modal-pause`: Centered dark carbon slate container with chamfered borders.
* `.modal-manifest`: Alphabetical table listing all repository modules and current versions.

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initUI(eventBus)`
* Mounts HUD elements, binds pointer/touch events, and configures modal dismissals.

#### `initInputListeners()`
* **Desktop Input:**
  * `KeyW`, `KeyA`, `KeyS`, `KeyD` / Arrows: Computes normalized chassis drive vector.
  * `PointerMove`: Computes turret aim angle relative to screen center.
  * `PointerDown` (Button 0): Activates continuous primary fire.
* **Mobile Touch Input (Split Screen):**
  * Left Half: Dynamic floating virtual joystick. Press anchors stick origin; drag produces normalized drive vector.
  * Right Half: Dynamic aim drag. Moving right thumb aims turret; holding right half auto-fires cannon.

#### `toggleFullscreen()`
* Calls `document.documentElement.requestFullscreen()` with WebKit fallback (`webkitRequestFullscreen`).
* Applies CSS `env(safe-area-inset-top)` to maintain HUD alignment on notched displays.

#### `openModal(modalElement)` / `closeModal(modalElement)`
* Manages 4-Way modal dismissal: Close button, backdrop tap, `Escape` key, and `popstate` back navigation (`history.pushState()`).
* Pauses fixed-step physics engine while Pause or Manifest modal is open.

#### `renderManifest(manifestData)`
* Populates `.modal-manifest` dropdown with all repository files sorted strictly alphabetically with version badges.