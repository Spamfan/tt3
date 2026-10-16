# Tank Tycoon (prototype 3)
### tt3
### Living Design Document (LDD) V8

---

### 1. WATERFALL PROTOCOL & DUAL DELIVERY

#### Supreme Governance Mandate
* `md-spec-project.md` is the supreme governing rulebook for all LLM-PL collaboration across Mode A and Mode B.
* All gate rules, inbound checks, version ceilings, and delivery constraints override default assistant behavior.

#### The Loop
1. **Sprint Plan (SP):** Scope & target files.  
   *End prompt:* "Reply 'yes' to proceed to Tech Spec."  
2. **Tech Spec (TS):** Functions & logic diffs.  
   *End prompt:* "Reply 'yes' to proceed to Execution."  
3. **Execution:** Authorized delivery via Mode A or Mode B.  

#### Gate Rules
* **Prompted Handshake:** Gates advance *only*  
  in response to an active LLM gate prompt.  
  Unprompted "yes" never advances a gate.  
* **Triggers:** `yes`, `proceed`, `do it`, `patches`.  
* **Hard Stop:** Halt after every phase.  
  Never combine phases in one turn.  
* **Scope & Tone:** Bullets only. No fluff.  
  Declare file paths. No unasked refactors.  
* **Mobile Wrap (Mode B Only):**  
  In Mode B planning & chat turns, break  
  lines manually (<35-40 chars) to prevent  
  mobile clipping. Mode A (chat planning  
  and patch code blocks) is exempt.  
* **Pathway Declaration:** At session start /  
  Turn 1 Inbound Check, the LLM must declare  
  the active delivery pathway (Mode A default  
  or Mode B) and state it will proceed under  
  that mode until explicitly redirected.  
* **LDD Version Integer Bump:** Any edit to a  
  Living Design Document strictly increments  
  its integer version (`V(N)` → `V(N+1)`).  
  The root filename remains unversioned  
  (`md-spec-project.md`).  
* **Default Bump & Ceiling Guard:** Submodules  
  must increment strictly by `+0.0.1` per sprint.  
  Bumping `+[0.1+]` or to `v1.0.0+` is strictly  
  barred without explicit PL sign-off. Submodules  
  must remain within pre-1.0 (`v0.x.x`).  

#### Delivery Pathways (Mode A vs Mode B)

##### Mode A: Traditional Patch Delivery (Chat LLM)
* **Automated Regex Engine Target:** Patches are parsed directly by an automated software patcher. Byte-for-byte fidelity is mandatory. Any whitespace, indentation, or character hallucination causes catastrophic failure.
* **Unified Multi-File Delivery:** Deliver all patches across all modified files in a single unified markdown response.
* **Target File Demarcation & Ordering:** Every file segment MUST begin with:
  `### TARGET FILE: path/to/file.ext`
  or for dynamic renaming during patching:
  `### TARGET FILE: path/to/old_file.ext -> path/to/new_file.ext`
  In multi-file deliveries, target file segments must be ordered strictly alphabetically by target source filename.
* **Strict Sequential Patch Headers:** Explicitly state patch index and total count: `Patch X/Y`.
* **Literal Contiguous Matching (Zero Shortcuts):** Matches are strictly applied via character-by-character regex slices. `Find`, `Find start`, and `Find end` blocks must be uninterrupted, contiguous slices of literal code. Never bridge code with ellipses (`...`, `...and...`, or `// rest of code`).
* **Patch Methods (Standard vs. Range):**
  * **Method 1: Standard Exact Match (Mandatory Default, 1–15 lines):** Replaces exact matching block using `Find` and `Replace with`. This is the required default for all code updates.
  * **Method 2: Range Match with Spatial Anchors (Strictly for Complete Block Rewrites):** Reserved exclusively for total block rewrites or deletions. Must NEVER be used to bridge distant edits.
    * **Engine Cursor Mechanics:** The patcher locates `Find start`, sets search pointer to `cursor = start_match.index + start_match.length`, and searches forward for `Find end`. Replaces `[start_match.start() ... end_match.end()]` inclusive.
    * **Zero-Intersection Rule:** `Find end` must exist strictly downstream of `Find start`. `Find end` (and any substring thereof) must NEVER appear inside `Find start`.
    * **Minimal Boundary Span (2–4 Lines Mandate):** `Find start` and `Find end` are spatial boundary anchors only, NOT code payloads. Each anchor must be strictly 2–4 unique lines. NEVER paste the replacement body inside `Find start`.
* **Anti-Drift Patch Constraints (Zero Tolerance):**
  * **Surgical Atomicity Mandate:** Disconnected edits separated by >3 lines must be split into separate micro-patches (`Patch 1/N`, `Patch 2/N`). Bridging untouched lines across disconnected edits is prohibited.
  * **Engine First-Match Defense:** JavaScript patch engines use `String.prototype.replace()`, replacing only the first occurrence. `Find` blocks MUST include 1–2 unique enclosing lines of context (function headers, distinct parent statements) to prevent collision with identical lines earlier in the file.
  * **Verbatim Grounding & Whitespace Fidelity:** Anchors must be copied byte-for-byte from intake files. Zero whitespace, tab, or indentation reformatting.
  * **Single-Scope Boundary Mandate:** Every patch must be scoped strictly to a single function, method, object, or CSS rule set.
  * **Zero Unmodified Pass-Through:** A patch payload (`Replace with`) must NEVER contain untouched sibling code simply to bridge two separate changes. Split into sequential patches instead.
  * **Payload Ceiling:** Standard matches must remain 1–15 lines; Range match replacement bodies must never exceed 40 lines.
* **Post-Patch Manifest Declaration (Strictly Alphabetical):** Every delivery must conclude with:
  1. Target declaration: `These edits apply to: [list]` (alphabetical)
  2. Alphabetical list of updated files & versions.
  3. Active Manifest Roster in strict alphabetical order marked `[UPDATED]` or `[unchanged]`.

###### Mode A Template Reference

*Sample Standard Patch Format:*
```
Patch 1/2
Find
` ` `html
<div class="old-header">Old Header</div>
` ` `
Replace with
` ` `html
<div class="new-header">New Header</div>
` ` `
```

*Sample Range Patch Format:*
```
Patch 2/2
Find start
` ` `html
<div class="card-container">
` ` `
Find end
` ` `html
</div><!-- end card -->
` ` `
Replace with
` ` `html
<div class="card-container">
    <p>New Card Content</p>
</div><!-- end card -->
```

*Sample Multi-File Demarcation:*
```
### TARGET FILE: styles.css

Patch 1/1
Find
...
Replace with
...

### TARGET FILE: js-app.js

Patch 1/1
Find start
...
Find end
...
Replace with
...
```

##### Mode B: Spark Agent (Workspace & Drive)
* **Zero Chat Patches:** Mode A and Mode B are mutually exclusive. Zero code patches, blocks, or full file dumps in chat.
* **Workspace Execution:** Synthesize files directly in sandbox; validate headlessly (`node --input-type=module -c`).
* **Google Drive Isolation Boundary:** Restricted **strictly** to folder `just Gemini stuff`. Never mutate anything outside.
* **Zip Deliverable:** Package modified files into `just Gemini stuff/update_vX.X.X.zip`.
* **Chat Output Limits:** Restricted strictly to direct Drive link, test status, and Manifest Roster.

---

### 2. INBOUND CHECKS & MEDIA RULES

* **Universal Inbound Check:** Trigger on  
  *any* upload at *any* turn. Inspect file  
  header/version *before* planning/diagnosing.  
* **Stacked Status Tags:** Emoji first:  
  `✅ [MATCH] file.ext`  
  `↳ vX.X.X verified`  
  `⚠️ [STALE] file.ext`  
  `↳ found vX.X.X`  
  `⚠️ [UNKNOWN] file.ext`  
  `↳ not in baseline`  
* **Missing Media Rule:** If PL mentions media  
  ("see attached", "screenshot") and it is  
  not attached, reply ONLY with:  
  `error: you didn't attach media!`  

---

### 3. WORKSPACE, DRIVE & EXECUTION SIGN-OFF

* **Drive Isolation (Mode B Only):** The agent  
  is authorized **exclusively** to create files  
  inside the Google Drive folder: `just Gemini stuff`.  
  Touching or modifying anything outside is forbidden.  
* **Surgical Edits:** Targeted lines only.  
  Unchanged lines must remain byte-for-byte  
  identical across both delivery modes.  
* **Execution Sign-Off Requirements:**  
  * Every delivery turn must conclude with:  
    1. Target file declaration: `These edits apply to: [list]` (alphabetical)  
    2. Alphabetical list of updated files & bumped versions.  
    3. Mode A: Applied patches ready for extraction.  
       Mode B: Direct Drive link to `update_vX.X.X.zip`.  
    4. Active Manifest Roster in strict alphabetical order showing all modules marked:  
       `[UPDATED]`, `[unchanged]`, or `[unchanged - floor]`.  

---

### 4. GLOBAL UI & NAVIGATION

* **Photorealistic Tactical Aesthetic:** Dark slate  
  surfaces (`#12171e`, `#1b222d`), muted tactical olive  
  moss terrain (`#475422`), natural beach sand contours  
  (`#cbb185`), deep lake slate (`#182633`), steel-blue  
  player hull, desert khaki enemies. Subtle borders  
  without saturated neon glows.  
* **Top-Anchor Tactical HUD:**  
  * Top-Left: Discreet borderless monospace watermark  
    `v0.0.4` (tap -> manifest).  
  * Top-Center: Compact dark HP bar (`100/100`), live  
    cash counter (`$0.00`), tactical SVG inventory pouch  
    (`.hud-btn-inventory` tap opens `.modal-inventory`  
    to inspect Steel, Copper, Aluminum and trigger  
    2x2 `base_block` placement at 10 Steel).  
  * Top-Right: Pause SVG button (`||`).  
* **Camera Scale & Zoom:** `CAMERA_ZOOM = 0.8` (+25%  
  visible world area for tactical awareness).  
* **Fullscreen & Safe Area:** Fullscreen toggle via  
  `requestFullscreen()` with iOS WebKit fallback  
  and `env(safe-area-inset-top)` notch padding.  
* **Juicy Custom Pause Modal:** Halo Reach styled  
  dialogue with Resume button, SFX toggle (persisted  
  state-only `sfxEnabled` boolean stub in v0.0.1 until  
  Web Audio synth is added in a future sprint),  
  Settings, caution "Reset World" (custom confirmation  
  modal), and Alphabetical Repo Manifest dropdown.  
* **Icons & Feedback:** Inline SVGs only across UI.  
  CSS keyframe spinners on async actions.  
* **4-Way Modal Dismissal & History Trapping:**  
  Dismiss via close button, backdrop tap, `Escape`,  
  or browser back button (`popstate` via `pushState`).  

---

### 5. SYSTEM & ARCHITECTURE CONSTRAINTS

* **Prefix & Flat Root Mandate:** All files live  
  at root. `js-` for scripts, `md-` for specs,  
  `styles.css` for styles, `index.html` for shell.  
  App hosts publicly at `spamfan.github.io/tt3`;  
  all HTML/CSS/module paths must use strict relative  
  prefixes (`./file.ext?v=0.0.1`), never root-relative.  
* **Modular Scalability Mandate:** All subsystems  
  must remain loosely coupled via event-bus hooks  
  and extensible schema registries to support large-  
  scale expansions (custom tank skins, new biome  
  generators, active abilities, and base stations).  
* **Fixed Timestep Accumulator (60–144Hz):** Game  
  physics strictly step at `1/60s` (`FIXED_STEP`).  
  `requestAnimationFrame` feeds accumulator with  
  render interpolation. Eliminates high-Hz desync.  
* **Cache-Busting & Downstream Ripple Mandate:**  
  Submodule imports must pin version query strings  
  (`./js-module.js?v=0.0.1`). Any submodule bump cascades  
  to downstream consumers `index.html`, `js-main.js`, and  
  `js-manifest.js`. Static assets must bind to host version  
  tokens (`?v=${MODULE_VERSION}`). Updating an asset under  
  the same filename mandates a version bump to bust caching.  
* **Procedural Chunking:** Deterministic seeded grid  
  (`16x16` tiles, `48x48px`). Safe spawn at `(0, 0)`;  
  enemy density & harsh biomes scale radially outward.  
  `worldSeed` is randomly generated on first boot,  
  persisted in IndexedDB, and re-rolled only on  
  Reset World.  
* **Terrain Speeds:** Grass (`1.0x`), Sand/Gravel  
  (`0.7x`), Water (`0.25x`, blocks base placement),  
  Dirt patches. Zero wild scrap crate clutter.  
* **Combat & Kinematics:** Decoupled chassis/turret.  
  Continuous auto-fire on aim. Player 100 HP, 10 dmg  
  cannon. Base enemies: 30 HP, 10 dmg, 1 shot/s,  
  rudimentary tracking, spawns in groups of 1–3.  
* **Loot Drops:** 1–2 items/kill: +25 HP orb (if  
  HP < 100, 25%), Steel (50%), Copper (25%),  
  Aluminum (25%). Separate roll: 25% for $1–$10 cash.  
* **Death, Respawn & Salvage:** Active respawn pad =  
  respawn at nearest pad; inventory drops into a  
  persistent Salvage Crate at death coordinates.  
  No respawn pad = Game Over modal.  
* **Base Building:** Unlocked at 10 Steel. 2x2 tank  
  concrete slab on grid. Standing on a placed base slab  
  reveals `.hud-btn-interact` to upgrade that slab into  
  a Respawn Pad (5 Steel + $25, adds white/green plus pad).  
* **State Persistence:** IndexedDB storage for world  
  seed, discovered chunks, player inventory, and bases.  
* **Target Benchmark Hardware Matrix:**  
  * Low-End: Samsung Galaxy A03s (PowerVR/3GB), iPhone  
    SE 2nd gen, Windows 7 laptop (Intel HD).  
  * High-Refresh: Pixel 9 Pro XL & iPhone 16 Pro (120Hz),  
    Motorola Edge 2024 & Gaming PC Displays (144Hz).  
  * Invariant: Fixed 60Hz physics step across all tiers.  
* **Data Ordering & Determinism:** Tables, catalog listings,  
  and serialized state must maintain deterministic ordering  
  (e.g. strict alphabetical sorting by primary key).  
* **Terminology & Lexicon Guard:** Enforce strict domain  
  lexicon across UI and code (e.g. scrap resources: `Steel`,  
  `Copper`, `Aluminum`; currency: `Cash`; avoid generic terms).  

---

### 6. BASELINE FLOOR & FILE TREE

#### Version Floor
* **App (Tank Tycoon [prototype 3]):** `v0.0.4`  
* **`index.html`:** `v0.0.4`  
* **`js-engine-physics.js`:** `v0.0.3`  
* **`js-engine-render.js`:** `v0.0.2`  
* **`js-engine-world.js`:** `v0.0.2`  
* **`js-main.js`:** `v0.0.4`  
* **`js-manifest.js`:** `v0.0.4`  
* **`js-state-player.js`:** `v0.0.1`  
* **`js-state-storage.js`:** `v0.0.1`  
* **`js-ui-controller.js`:** `v0.0.2`  
* **`md-spec-physics.md`:** `V2`  
* **`md-spec-project.md`:** `V8`  
* **`md-spec-render.md`:** `V2`  
* **`md-spec-storage.md`:** `V2`  
* **`md-spec-tank.md`:** `V1`  
* **`md-spec-ui.md`:** `V3`  
* **`md-spec-world.md`:** `V3`  
* **`styles.css`:** `v0.0.3`  

#### File Tree
* `index.html`
* `js-engine-physics.js`
* `js-engine-render.js`
* `js-engine-world.js`
* `js-main.js`
* `js-manifest.js`
* `js-state-player.js`
* `js-state-storage.js`
* `js-ui-controller.js`
* `md-spec-physics.md`
* `md-spec-project.md`
* `md-spec-render.md`
* `md-spec-storage.md`
* `md-spec-tank.md`
* `md-spec-ui.md`
* `md-spec-world.md`
* `styles.css`

---

### 7. SUB-SPOKE DIRECTORY & CONTEXT GUARD

All specification and reference markdown  
files reside directly at the project root.  
When modifying specific subsystems, attach  
the corresponding spec from root:  
* `md-spec-physics.md` -> `js-engine-physics.js`  
* `md-spec-render.md` -> `js-engine-render.js`  
* `md-spec-storage.md` -> `js-state-storage.js`  
* `md-spec-tank.md` -> `js-state-player.js`  
* `md-spec-ui.md` -> `js-ui-controller.js`, `styles.css`  
* `md-spec-world.md` -> `js-engine-world.js`  

* **Pre-Flight File Lockout:** If target files  
  are missing or requested, reply ONLY with the  
  required intake file list and halt.  
* **Context Guard & Consumer Intake:** If a task  
  touches these files and the spec is unattached,  
  the LLM must ask the user to attach it before starting.  
  Furthermore, whenever a sub-spoke bump occurs,  
  the LLM must explicitly mandate the intake upload of  
  the main entry script (`js-main.js`), host HTML shell  
  (`index.html`), and repo manifest (`js-manifest.js`)  
  during intake to guarantee end-to-end cache busting.  
