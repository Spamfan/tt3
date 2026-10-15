# State Storage & Persistence Specification
### Sub-Spoke Specification: js-state-storage.js
### Version v0.0.1

---

### 1. SYSTEM OVERVIEW
Manages asynchronous client-side persistence through IndexedDB. Guarantees deterministic serialization and retrieval of world chunks, player coordinates, inventory, base blocks, and player death salvage crates.

---

### 2. DATABASE CONFIGURATION
* `DB_NAME = "TankTycoonDB"`
* `DB_VERSION = 1`
* Object Stores:
  1. `world_chunks`: KeyPath `chunkKey` (`"x,y"`). Stores tile modifications and placed structures.
  2. `player_state`: KeyPath `"id"`. Stores health, cash, steel, copper, aluminum, and unlock state.
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

#### `loadGameState()`
* Restores player coordinates, resources, discovered chunks, active base blocks, and salvage crates.
* Returns null if no prior save exists (triggers fresh spawn at `(0, 0)`).

#### `wipeSaveData()`
* Clears all IndexedDB object stores.
* Deletes player save record and forces hard re-initialization of baseline `v0.0.1` world.