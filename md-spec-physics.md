# Physics & Kinematics Subsystem Specification
### Sub-Spoke Specification: js-engine-physics.js
### Version V2

---

### 1. SYSTEM OVERVIEW
The physics engine manages deterministic collision detection, decoupled tank kinematics, projectile motion, terrain friction modifiers, and scrap resource magnetism. It runs strictly on a fixed clock to guarantee identical mechanics across 60Hz, 120Hz, and 144Hz displays.

---

### 2. CLOCK & INTEGRATION CONSTANTS
* `FIXED_STEP = 1 / 60` (0.016666s per physics tick).
* `MAX_ACCUMULATOR = 0.1` (clamped to prevent spiral of death on background tabs).
* `CHASSIS_ACCEL = 480.0` px/s².
* `CHASSIS_DRAG = 0.88` (per-tick damping coefficient).
* `CHASSIS_TURN_SPEED = 3.6` rad/s.
* `TURRET_TURN_SPEED = 8.0` rad/s.
* `RECOIL_FORCE = 120.0` px/s (instantaneous impulse vector opposite to turret aim).
* `PROJECTILE_SPEED = 620.0` px/s.
* `MAGNET_RADIUS = 120.0` px (radial drop vacuum).
* `MAGNET_ACCEL = 750.0` px/s².

---

### 3. EXPORTED INTERFACES & FUNCTIONS

#### `updatePhysics(dt, gameState)`
* Drives the fixed tick accumulator.
* Processes entity velocity, applies drag, resolves tile collision, advances projectiles, and handles resource collection.

#### `resolveTankKinematics(tank, moveVector, currentTileSpeed, dt)`
* **Decoupled Steering:** Moves chassis toward `moveVector` while preserving momentum.
* **Surface Dampening:** Multiplies acceleration and top speed by tile speed multiplier:
  * Grass: `1.0x`
  * Sand / Gravel: `0.7x`
  * Water: `0.25x`
* **Angular Lerp:** Interpolates chassis rotation toward motion heading; turret angle tracks cursor / aim vector independently.

#### `checkSweptAABB(boxA, boxB, velocity)`
* Continuous collision check between moving entities and impassable map tiles/structures to prevent high-speed tunneling.

#### `applyRecoil(tank, turretAngle, kickForce)`
* Injects backward velocity impulse directly opposite `turretAngle`.

#### `updateProjectiles(projectiles, entities, world, dt)`
* Steps projectile positions along their trajectory vectors.
* Performs raycast/circle intersection against tanks and obstacles.
* Inflicts 10 damage per impact; despawns projectile on hit or max range (960px).
* When an enemy tank's HP drops to 0, checks if any living foes remain in that enemy's chunk; if none remain, marks the chunk's `clearedEnemies = true` and `modified = true` so hostile tanks do not respawn.

#### `updateScrapMagnetism(player, pickups, dt)`
* Computes Euclidean distance from `player` center to each active pickup.
* When distance `< MAGNET_RADIUS`, accelerates pickup toward player center using quadratic pull with per-tick velocity damping (`* 0.94`) to eliminate orbital slingshot rotation:
  `pickup.velocity = (pickup.velocity + normalize(player.pos - pickup.pos) * MAGNET_ACCEL * dt) * 0.94`.