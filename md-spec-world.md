# World Generation & Chunking Specification
### Sub-Spoke Specification: js-engine-world.js
### Version V1

---

### 1. SYSTEM OVERVIEW
Generates a deterministic procedural world based on coordinate chunking and pseudo-random noise. Regulates surface movement speed penalties, radial threat zones, zero floor loot rules, and base block grid snapping.

---

### 2. CHUNK ARCHITECTURE & TILE MATRICES
* `CHUNK_TILES = 16` (16x16 tiles per chunk).
* `TILE_SIZE = 48` px (chunk footprint: `768x768` px).
* Tile Definitions:
  * `0: TILE_GRASS` - Bright stylized green (`#38b000`, `#70e000`). Speed `1.0x`. Passable. Buildable.
  * `1: TILE_DIRT` - Packed earth path (`#b79257`). Speed `1.0x`. Passable. Buildable.
  * `2: TILE_SAND` - Coastline gravel/sand (`#e9d8a6`). Speed `0.7x`. Passable. Buildable.
  * `3: TILE_WATER` - Lake/river blue (`#0077b6`). Speed `0.25x`. Passable (crawl). Buildable: NO.
  * `4: TILE_BASE_CONCRETE` - Industrial concrete (`#4a5568`). Speed `1.0x`. Passable. Buildable: YES.
  * `5: TILE_BASE_RESPAWN` - Concrete with white/green plus pad. Speed `1.0x`. Passable. Buildable: NO.
* **Reserved Biome ID Ranges:**
  * `10–19: BIOME_DESERT` - Dune sand (`0.6x` speed), cactus obstacles, outposts.
  * `20–29: BIOME_WASTELAND` - Radiation slag (`0.4x` speed), scrap craters, heavy enemies.
* **Zero Floor Loot Policy:** No random scrap crates or pickups spawn naturally on terrain. Resources are acquired solely via enemy destruction.

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initWorld(worldSeed)`
* Instantiates deterministic noise generator using integer/string seed.

#### `getChunk(chunkX, chunkY)`
* Returns cached chunk from memory/IndexedDB or generates it deterministically.
* **Radial Difficulty Generation:**
  * Distance: `radius = Math.sqrt(chunkX * chunkX + chunkY * chunkY)`.
  * Safe Zone (`radius <= 2` chunks): Peaceful grass clearing, occasional rivers/lakes, sand borders. Zero hostile tanks.
  * Hostile Zone (`radius > 2` chunks): Enemy tank groups (1–3 tanks) spawn in open grass clearing points. Hostility and cluster density scale radially outward.

#### `getTileAtWorldPos(worldX, worldY)`
* Resolves world pixel coordinates into chunk indices `(chunkX, chunkY)` and local tile indices `(tileX, tileY)`.
* Returns tile type ID and surface speed multiplier (`1.0x`, `0.7x`, or `0.25x`).

#### `placeBaseBlock(gridOriginX, gridOriginY, blockType)`
* Snaps to 2x2 tank dimensions (`96x96` px = 2x2 tiles).
* Validates terrain: returns `false` if any underlying tile is `TILE_WATER`.
* Converts underlying tiles to `TILE_BASE_CONCRETE` and persists modification.

#### `calculateEnemyLoot(enemyTank, playerHP)`
* Computes enemy drops upon destruction (1–2 items total):
  * Item count: 50% chance for 1 item, 50% chance for 2 items.
  * Item pool:
    * If `playerHP < 100`: 25% chance for Health Orb (+25 HP).
    * Steel: 50% relative weight.
    * Copper: 25% relative weight.
    * Aluminum: 25% relative weight.
  * Separate roll: 25% chance to drop bonus Cash ($1.00–$10.00).

---

### 4. FORWARD BASE STATION SCHEMA HOOKS
* `STATION_INCOME` (Type ID: 10): Generates passive cash ($1–$5/min).
* `STATION_REPAIR` (Type ID: 11): Regenerates player HP at 5 HP/sec when docked.
* `STATION_GARAGE` (Type ID: 12): Storage and loadout swapping bay.
* `STATION_TURRET` (Type ID: 13): Automated defense turret engaging hostiles within 240px.