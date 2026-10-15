# State Storage & Persistence Specification
### Sub-Spoke Specification: js-state-storage.js
### Version V2

---

### 1. SYSTEM OVERVIEW
Manages asynchronous client-side persistence through IndexedDB. Guarantees deterministic serialization and retrieval of world chunks, player coordinates, inventory, base blocks, and player death salvage crates.

---

### 2. DATABASE CONFIGURATION
* `DB_NAME = "TankTycoonDB"`
* `DB_VERSION = 1`
* Object Stores:
  1. `world_chunks`: KeyPath `chunkKey` (`"x,y"`). Stores tile modifications and placed structures.
  2. `player_state`: KeyPath `"id"`. Persists `hp`, `maxHp`, `cash`, `steel`, `copper`, `aluminum`, `recipes`, coordinates (`x`, `y`, `chassisAngle`, `turretAngle`), `worldSeed` (randomized seed string), `sfxEnabled` (boolean stub), and forward hooks (`armorLevel`, `specialAbility`, `chassisCustomization`, `stationSlots`).
  3. `salvage_crates`: KeyPath `"crateId"`. Stores dropped inventory crates with world coordinates.
  4. `base_blocks`: KeyPath `"blockId"`. Stores placed base slabs, coordinates, and respawn pad upgrades.

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initStorage()`
* Opens connection to `TankTycoonDB`.
* Sets up object stores on `onupgradeneeded`.
* Returns Promise resolving to active database instance.

#### `saveGameState(state)`
* Serializes active state inside an atomic `readwrite` transaction.
* Debounced to execute every 5.0 seconds and immediately upon:
  * Base block placement.
  * Respawn pad upgrade.
  * Player death or salvage retrieval.

#### `generateWorldSeed()`
* Generates a randomized seed string (`TT3-<RAND>-<TIME>`) for new worlds and resets.

#### `loadGameState()`
* Restores player coordinates, resources, discovered chunks, active base blocks, and salvage crates.
* Returns `null` if no prior save exists so `js-main.js` initializes a fresh randomized `worldSeed` at `(0, 0)`.

#### `wipeSaveData()`
* Clears all 4 IndexedDB object stores.
* Deletes player save record and returns a newly generated random `worldSeed` for immediate re-initialization at `(0, 0)`.