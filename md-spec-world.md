# World Generation & Chunking Specification
### Sub-Spoke Specification: js-engine-world.js
### Version V4

---

### 1. SYSTEM OVERVIEW
Generates a deterministic procedural world based on coordinate chunking and pseudo-random noise. Regulates surface movement speed penalties, radial threat zones, zero floor loot rules, and base block grid snapping.

---

### 2. CHUNK ARCHITECTURE & TILE MATRICES
* `CHUNK_TILES = 16` (16x16 tiles per chunk).
* `TILE_SIZE = 48` px (chunk footprint: `768x768` px).
* Tile Definitions:
  * `0: TILE_GRASS` - Muted olive/moss field (`#475422`). Speed `1.0x`. Passable. Buildable.
  * `1: TILE_DIRT` - Basalt carbon loam (`#635c49`). Speed `1.0x`. Passable. Buildable.
  * `2: TILE_SAND` - Natural contoured shore tan (`#cbb185`). Speed `0.7x`. Passable. Buildable.
  * `3: TILE_WATER` - Dark pond/lake navy (`#182633`). Speed `0.25x`. Passable (crawl). Buildable: NO.
  * `4: TILE_BASE_CONCRETE` - Reinforced matte slab (`#252b36`). Speed `1.0x`. Passable. Buildable: YES.
  * `5: TILE_BASE_RESPAWN` - Matte slab with medical plus pad. Speed `1.0x`. Passable. Buildable: NO.
* **Procedural Curving Generation:** Broad multi-octave noise generator (octave 1 wavelength 42.0 tiles, octave 2 wavelength 18.0 tiles) creating natural organic lake basins and smooth shoreline bands.
* **Reserved Biome ID Ranges:**
  * `10–19: BIOME_DESERT` - Dune sand (`0.6x` speed), cactus obstacles, outposts.
  * `20–29: BIOME_WASTELAND` - Radiation slag (`0.4x` speed), scrap craters, heavy enemies.
* **Zero Floor Loot Policy:** No random scrap crates or pickups spawn naturally on terrain. Resources are acquired solely via enemy destruction.

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initWorld(worldSeed)`
* Instantiates deterministic noise generator using integer/string seed.
* `worldSeed` comes from the randomized string persisted in `player_state` (and only re-rolls when Reset World wipes storage).

#### `getChunk(chunkX, chunkY)`
* Returns cached chunk from memory/IndexedDB or generates it deterministically.
* Chunks include a persisted `clearedEnemies` boolean flag so cleared hostile chunks do not respawn enemies after reload.
* **Radial Difficulty Generation:**
  * Distance: `radius = Math.sqrt(chunkX * chunkX + chunkY * chunkY)`.
  * Safe Zone (`radius <= 2` chunks): Peaceful grass clearing, occasional rivers/lakes, sand borders. Zero hostile tanks.
  * Hostile Zone (`radius > 2` chunks): Enemy tank groups (1–3 tanks) spawn in open grass clearing points. Hostility and cluster density scale radially outward.

#### `getTileAtWorldPos(worldX, worldY)`
* Computes surface speed dynamically from continuous noise field elevation (`sampleWorldElevation`):
  * `elev < 0.34`: Water (`0.25x` speed).
  * `elev < 0.43`: Sand (`0.7x` speed).
  * `elev >= 0.43`: Grass/firm terrain (`1.0x` speed).
* Player base blocks take precedence, granting `1.0x` firm concrete footing.

#### `placeBaseBlock(gridOriginX, gridOriginY, blockType)`
* Snaps to 2x2 tank dimensions (`96x96` px = 2x2 tiles).
* Validates terrain: returns `false` if any underlying tile is `TILE_WATER`.
* Converts underlying tiles to `TILE_BASE_CONCRETE` and persists modification.
* Companion helper `canPlaceBaseBlock(gx, gy)`: Rejects `TILE_WATER` and existing base tiles.
* Companion helper `upgradeBaseBlockToRespawn(block)`: Sets 2x2 slab tiles to `TILE_BASE_RESPAWN = 5`.

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