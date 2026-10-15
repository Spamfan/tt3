# Player & Enemy Tank Subsystem Specification
### Sub-Spoke Specification: js-state-player.js
### Version V1

---

### 1. SYSTEM OVERVIEW
Governs player tank stats, enemy tank specifications, inventory tracking, recipe unlocks, death handling, and respawn mechanics.

---

### 2. CORE STATS & ATTRIBUTES

#### Player Tank
* `MAX_HEALTH = 100`
* `CANNON_DAMAGE = 10`
* `FIRE_RATE = 1.0` shots/sec (fully automatic while aiming/holding fire).
* `COLLISION_RADIUS = 24` px (approx. 48x48px tank footprint).
* Carried Inventory: `cash`, `steel`, `copper`, `aluminum`.

#### Base Enemy Tank
* `HEALTH = 30`
* `CANNON_DAMAGE = 10`
* `FIRE_RATE = 1.0` shots/sec.
* `AGGRO_RADIUS = 360` px.
* `MOVE_SPEED = 140` px/s (basic tracking, non-dodging).
* Cluster Spawns: 1–3 tanks per group in hostile chunks.

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `initPlayerState()`
* Returns baseline player instance: `hp = 100`, `cash = 0.00`, `steel = 0`, `copper = 0`, `aluminum = 0`, `recipes = []`.

#### `modifyHealth(player, delta)`
* Clamps `hp` between `0` and `MAX_HEALTH`.
* If `hp <= 0`, calls `handlePlayerDeath()`.

#### `addInventory(player, resourceType, quantity)`
* Increments corresponding scrap resource or cash balance.
* Checks recipe unlock conditions:
  * If `player.steel >= 10` and `"base_block"` not in `recipes`: unlocks Base Block recipe and fires `EVENT_RECIPE_UNLOCKED`.

#### `craftItem(player, recipeId)`
* Validates inventory requirements:
  * `"base_block"`: Requires 10 Steel. Deducts 10 Steel and triggers placement mode.
  * `"respawn_pad"`: Requires 5 Steel and $25.00 cash. Upgrades selected base block.

#### `handlePlayerDeath(player, bases, world)`
* Drops all carried scrap (`steel`, `copper`, `aluminum`) and cash into a `SalvageCrate` at `(player.x, player.y)`.
* Locates nearest base block with an active respawn pad.
* **Respawn Branching:**
  * If valid pad found: Restores player to 100 HP, resets velocity, teleports to nearest pad center.
  * If zero pads exist across world: Dispatches `EVENT_GAME_OVER` to display Game Over modal.

---

### 4. FORWARD SCHEMA HOOKS & TYCOON EXPANSIONS
* `armorLevel`: Damage mitigation scalar (`damageTaken = rawDamage * (1 - armorMitigation)`).
* `specialAbility`: Reserved slot for active tank abilities (turbo boost, shield pulse).
* `chassisCustomization`: Colorway and decal skin metadata.
* `stationSlots`: Map of coordinates to attached station modules (`income`, `repair`, `garage`, `turret`).