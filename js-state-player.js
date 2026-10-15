// Tank Tycoon (prototype 3) - js-state-player.js (v0.0.1)
// Player & Enemy Tank Subsystem (Stats, Inventory, Crafting, Respawn)

export const MODULE_VERSION = "v0.0.1";

// Player Tank Constants
export const MAX_HEALTH = 100;
export const CANNON_DAMAGE = 10;
export const FIRE_RATE = 1.0; // shots/sec
export const COLLISION_RADIUS = 24; // 48x48px footprint

// Base Enemy Tank Constants
export const ENEMY_HEALTH = 30;
export const ENEMY_CANNON_DAMAGE = 10;
export const ENEMY_FIRE_RATE = 1.0; // shots/sec
export const AGGRO_RADIUS = 360; // px
export const ENEMY_MOVE_SPEED = 140; // px/s

// Domain Events
export const EVENT_RECIPE_UNLOCKED = "EVENT_RECIPE_UNLOCKED";
export const EVENT_GAME_OVER = "EVENT_GAME_OVER";
export const EVENT_PLAYER_RESPAWN = "EVENT_PLAYER_RESPAWN";
export const EVENT_INVENTORY_UPDATED = "EVENT_INVENTORY_UPDATED";

export const RECIPES = Object.freeze({
  base_block: {
    id: "base_block",
    name: "Base Concrete Block (2x2)",
    costSteel: 10,
    costCash: 0
  },
  respawn_pad: {
    id: "respawn_pad",
    name: "Respawn Pad Upgrade",
    costSteel: 5,
    costCash: 25
  }
});

export function initPlayerState(saved = null) {
  const base = {
    id: "player_main",
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    chassisAngle: 0,
    turretAngle: 0,
    targetTurretAngle: 0,
    recoilOffset: 0,
    fireCooldown: 0,
    radius: COLLISION_RADIUS,
    hp: MAX_HEALTH,
    maxHp: MAX_HEALTH,
    cash: 0.0,
    steel: 0,
    copper: 0,
    aluminum: 0,
    recipes: [],
    sfxEnabled: true,
    isDead: false,
    // Forward Schema Hooks & Tycoon Expansions (md-spec-tank.md §4)
    armorLevel: 0,
    armorMitigation: 0.0,
    specialAbility: null,
    chassisCustomization: {
      hullColor: "#1b4332",
      trimColor: "#00f0ff",
      turretColor: "#2d6a4f",
      decalId: "standard"
    },
    stationSlots: {}
  };

  if (saved && typeof saved === "object") {
    base.x = Number(saved.x ?? 0);
    base.y = Number(saved.y ?? 0);
    base.prevX = base.x;
    base.prevY = base.y;
    base.chassisAngle = Number(saved.chassisAngle ?? 0);
    base.turretAngle = Number(saved.turretAngle ?? 0);
    base.targetTurretAngle = base.turretAngle;
    base.hp = Math.max(1, Math.min(MAX_HEALTH, Number(saved.hp ?? MAX_HEALTH)));
    base.cash = Math.max(0, Number(saved.cash ?? 0));
    base.steel = Math.max(0, Math.floor(Number(saved.steel ?? 0)));
    base.copper = Math.max(0, Math.floor(Number(saved.copper ?? 0)));
    base.aluminum = Math.max(0, Math.floor(Number(saved.aluminum ?? 0)));
    base.recipes = Array.isArray(saved.recipes) ? [...saved.recipes] : [];
    base.sfxEnabled = saved.sfxEnabled !== false;
    base.armorLevel = Number(saved.armorLevel ?? 0);
    base.armorMitigation = Math.min(0.75, base.armorLevel * 0.05);
    base.specialAbility = saved.specialAbility || null;
    if (saved.chassisCustomization) {
      base.chassisCustomization = {
        ...base.chassisCustomization,
        ...saved.chassisCustomization
      };
    }
    if (saved.stationSlots) {
      base.stationSlots = { ...saved.stationSlots };
    }
    if (base.steel >= 10 && !base.recipes.includes("base_block")) {
      base.recipes.push("base_block");
    }
  }

  return base;
}

export function createEnemyTank(id, x, y, chunkKey = "0,0") {
  return {
    id: String(id),
    chunkKey,
    x: Number(x),
    y: Number(y),
    prevX: Number(x),
    prevY: Number(y),
    vx: 0,
    vy: 0,
    chassisAngle: Math.random() * Math.PI * 2,
    turretAngle: 0,
    targetTurretAngle: 0,
    recoilOffset: 0,
    fireCooldown: 0.4 + Math.random() * 0.6,
    radius: COLLISION_RADIUS,
    hp: ENEMY_HEALTH,
    maxHp: ENEMY_HEALTH,
    aggroRadius: AGGRO_RADIUS,
    moveSpeed: ENEMY_MOVE_SPEED,
    isEnemy: true
  };
}

export function modifyHealth(player, delta, context = {}) {
  if (!player || player.isDead) return player ? player.hp : 0;

  let effectiveDelta = Number(delta);
  if (effectiveDelta < 0) {
    const mitigation = Math.max(0, Math.min(0.75, player.armorMitigation || 0));
    effectiveDelta = effectiveDelta * (1 - mitigation);
  }

  player.hp = Math.max(0, Math.min(MAX_HEALTH, Math.round(player.hp + effectiveDelta)));

  if (player.hp <= 0) {
    return handlePlayerDeath(
      player,
      context.bases || [],
      context.world || null,
      context.eventBus || null
    );
  }

  return { hp: player.hp, dead: false };
}

export function addInventory(player, resourceType, quantity, eventBus = null) {
  if (!player) return false;
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return false;

  const normalized = String(resourceType).toLowerCase();
  if (normalized === "cash") {
    player.cash = Math.round((player.cash + qty) * 100) / 100;
  } else if (normalized === "steel") {
    player.steel += Math.floor(qty);
  } else if (normalized === "copper") {
    player.copper += Math.floor(qty);
  } else if (normalized === "aluminum") {
    player.aluminum += Math.floor(qty);
  } else if (normalized === "hp" || normalized === "hp_orb") {
    modifyHealth(player, qty);
  } else {
    return false;
  }

  if (!Array.isArray(player.recipes)) {
    player.recipes = [];
  }

  let unlockedNow = false;
  if (player.steel >= 10 && !player.recipes.includes("base_block")) {
    player.recipes.push("base_block");
    unlockedNow = true;
    if (eventBus && typeof eventBus.emit === "function") {
      eventBus.emit(EVENT_RECIPE_UNLOCKED, {
        recipeId: "base_block",
        recipe: RECIPES.base_block
      });
    }
  }

  if (eventBus && typeof eventBus.emit === "function") {
    eventBus.emit(EVENT_INVENTORY_UPDATED, {
      player,
      resourceType: normalized,
      quantity: qty,
      unlockedNow
    });
  }

  return true;
}

export function craftItem(player, recipeId, targetBlock = null) {
  if (!player) return { ok: false, reason: "Invalid player state" };

  if (recipeId === "base_block") {
    if (player.steel < RECIPES.base_block.costSteel) {
      return { ok: false, reason: "Requires 10 Steel" };
    }
    player.steel -= RECIPES.base_block.costSteel;
    if (!player.recipes.includes("base_block")) {
      player.recipes.push("base_block");
    }
    return { ok: true, recipeId: "base_block", mode: "placement" };
  }

  if (recipeId === "respawn_pad") {
    if (!targetBlock) {
      return { ok: false, reason: "Stand on a Base Block to upgrade" };
    }
    if (targetBlock.hasRespawnPad) {
      return { ok: false, reason: "Respawn Pad already active on this slab" };
    }
    if (
      player.steel < RECIPES.respawn_pad.costSteel ||
      player.cash < RECIPES.respawn_pad.costCash
    ) {
      return { ok: false, reason: "Requires 5 Steel + $25.00 Cash" };
    }
    player.steel -= RECIPES.respawn_pad.costSteel;
    player.cash = Math.round((player.cash - RECIPES.respawn_pad.costCash) * 100) / 100;
    targetBlock.hasRespawnPad = true;
    targetBlock.tileType = 5;
    return { ok: true, recipeId: "respawn_pad", block: targetBlock };
  }

  return { ok: false, reason: "Unknown recipe" };
}

export function handlePlayerDeath(player, bases = [], world = null, eventBus = null) {
  let salvageCrate = null;
  const hasLoot =
    player.cash > 0 ||
    player.steel > 0 ||
    player.copper > 0 ||
    player.aluminum > 0;

  if (hasLoot) {
    salvageCrate = {
      crateId: `crate_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: player.x,
      y: player.y,
      cash: player.cash,
      steel: player.steel,
      copper: player.copper,
      aluminum: player.aluminum,
      createdAt: Date.now()
    };
    player.cash = 0.0;
    player.steel = 0;
    player.copper = 0;
    player.aluminum = 0;
  }

  if (
    salvageCrate &&
    world &&
    Array.isArray(world.salvageCrates)
  ) {
    world.salvageCrates.push(salvageCrate);
  }

  // Locate nearest base block with an active respawn pad
  const activePads = Array.isArray(bases)
    ? bases.filter((b) => b && b.hasRespawnPad)
    : [];

  if (activePads.length > 0) {
    let nearestPad = activePads[0];
    let bestDistSq = Infinity;
    for (const pad of activePads) {
      const dx = pad.worldX - player.x;
      const dy = pad.worldY - player.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearestPad = pad;
      }
    }

    player.hp = MAX_HEALTH;
    player.isDead = false;
    player.vx = 0;
    player.vy = 0;
    player.x = nearestPad.worldX;
    player.y = nearestPad.worldY;
    player.prevX = nearestPad.worldX;
    player.prevY = nearestPad.worldY;

    const outcome = {
      dead: true,
      respawned: true,
      pad: nearestPad,
      salvageCrate
    };
    if (eventBus && typeof eventBus.emit === "function") {
      eventBus.emit(EVENT_PLAYER_RESPAWN, outcome);
    }
    return outcome;
  }

  player.hp = 0;
  player.isDead = true;
  player.vx = 0;
  player.vy = 0;

  const outcome = {
    dead: true,
    respawned: false,
    gameOver: true,
    salvageCrate
  };
  if (eventBus && typeof eventBus.emit === "function") {
    eventBus.emit(EVENT_GAME_OVER, outcome);
  }
  return outcome;
}
