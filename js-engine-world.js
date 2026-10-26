// Tank Tycoon (prototype 3) - js-engine-world.js (v0.0.4)
// Continuous Organic Elevation Sampling, Seeded Chunking & Base Building

export const MODULE_VERSION = "v0.0.4";

export const CHUNK_TILES = 16;
export const TILE_SIZE = 48;
export const CHUNK_PIXEL_SIZE = CHUNK_TILES * TILE_SIZE; // 768px

// Core Tile Identifiers
export const TILE_GRASS = 0;
export const TILE_DIRT = 1;
export const TILE_SAND = 2;
export const TILE_WATER = 3;
export const TILE_BASE_CONCRETE = 4;
export const TILE_BASE_RESPAWN = 5;

// Station Schema Identifiers
export const STATION_INCOME = 10;
export const STATION_REPAIR = 11;
export const STATION_GARAGE = 12;
export const STATION_TURRET = 13;

let activeWorldState = null;

function hashSeedString(seedStr) {
  const str = String(seedStr || "TT3-DEFAULT");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function coordHash(x, y, seedInt) {
  let h = seedInt ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(wx, wy, scale, seedInt) {
  const sx = wx / scale;
  const sy = wy / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const n00 = coordHash(x0, y0, seedInt);
  const n10 = coordHash(x0 + 1, y0, seedInt);
  const n01 = coordHash(x0, y0 + 1, seedInt);
  const n11 = coordHash(x0 + 1, y0 + 1, seedInt);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

// Continuous Elevation Field Evaluator
export function sampleWorldElevation(worldX, worldY, worldState = activeWorldState) {
  const world = worldState || getActiveWorld();
  const tx = worldX / TILE_SIZE;
  const ty = worldY / TILE_SIZE;

  // Safe clearing around spawn (0, 0)
  if (Math.hypot(tx, ty) < 6) {
    return 0.8;
  }

  return (
    valueNoise2D(tx, ty, 42.0, world.seedInt) * 0.75 +
    valueNoise2D(tx, ty, 18.0, world.seedInt ^ 0x9e3779b9) * 0.25
  );
}

export function initWorld(worldSeed = "TT3-0001") {
  const seed = String(worldSeed || "TT3-0001");
  const seedInt = hashSeedString(seed);
  activeWorldState = {
    seed,
    seedInt,
    chunks: new Map(),
    baseBlocks: [],
    salvageCrates: [],
    spawnedChunks: new Set()
  };
  return activeWorldState;
}

export function getActiveWorld() {
  if (!activeWorldState) {
    return initWorld();
  }
  return activeWorldState;
}

export function getChunk(chunkX, chunkY, worldState = activeWorldState) {
  const world = worldState || getActiveWorld();
  const key = `${chunkX},${chunkY}`;
  if (world.chunks.has(key)) {
    return world.chunks.get(key);
  }

  const radius = Math.sqrt(chunkX * chunkX + chunkY * chunkY);
  const enemySpawns = [];

  if (radius > 2) {
    const countRoll = coordHash(chunkX, chunkY, world.seedInt ^ 0xc2b2ae35);
    const groupSize = countRoll < 0.4 ? 1 : countRoll < 0.8 ? 2 : 3;

    for (let i = 0; i < groupSize; i++) {
      const rx = Math.floor(
        coordHash(chunkX * 31 + i, chunkY * 17 + i, world.seedInt) * (CHUNK_TILES - 4)
      ) + 2;
      const ry = Math.floor(
        coordHash(chunkX * 19 + i, chunkY * 29 + i, world.seedInt ^ 0x27d4eb2f) * (CHUNK_TILES - 4)
      ) + 2;

      const worldX = (chunkX * CHUNK_TILES + rx + 0.5) * TILE_SIZE;
      const worldY = (chunkY * CHUNK_TILES + ry + 0.5) * TILE_SIZE;

      // Spawn hostiles on dry land only
      const elev = sampleWorldElevation(worldX, worldY, world);
      if (elev >= 0.38) {
        enemySpawns.push({
          id: `foe_${chunkX}_${chunkY}_${i}`,
          x: worldX,
          y: worldY,
          chunkKey: key
        });
      }
    }
  }

  const chunk = {
    chunkKey: key,
    chunkX,
    chunkY,
    radius,
    isHostile: radius > 2,
    enemySpawns,
    modified: false,
    discovered: true,
    clearedEnemies: false,
    terrainCanvas: null
  };

  world.chunks.set(key, chunk);
  return chunk;
}

export function getTileAtWorldPos(worldX, worldY, worldState = activeWorldState) {
  const world = worldState || getActiveWorld();

  // 1. Check for player-placed base slabs first
  const baseBlock = getBaseBlockAtWorldPos(worldX, worldY, world.baseBlocks);
  if (baseBlock) {
    return {
      tileId: baseBlock.tileType,
      speedMultiplier: 1.0,
      passable: true,
      buildable: !baseBlock.hasRespawnPad
    };
  }

  // 2. Dynamic continuous elevation evaluation
  const elev = sampleWorldElevation(worldX, worldY, world);

  if (elev < 0.34) {
    return {
      tileId: TILE_WATER,
      speedMultiplier: 0.25,
      passable: true,
      buildable: false
    };
  } else if (elev < 0.43) {
    return {
      tileId: TILE_SAND,
      speedMultiplier: 0.7,
      passable: true,
      buildable: true
    };
  }

  return {
    tileId: TILE_GRASS,
    speedMultiplier: 1.0,
    passable: true,
    buildable: true
  };
}

export function canPlaceBaseBlock(gridOriginX, gridOriginY, worldState = activeWorldState) {
  const world = worldState || getActiveWorld();
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const wx = (gridOriginX + dx + 0.5) * TILE_SIZE;
      const wy = (gridOriginY + dy + 0.5) * TILE_SIZE;
      const tile = getTileAtWorldPos(wx, wy, world);
      if (tile.tileId === TILE_WATER || tile.tileId === TILE_BASE_CONCRETE || tile.tileId === TILE_BASE_RESPAWN) {
        return false;
      }
    }
  }
  return true;
}

export function placeBaseBlock(
  gridOriginX,
  gridOriginY,
  blockType = TILE_BASE_CONCRETE,
  worldState = activeWorldState
) {
  const world = worldState || getActiveWorld();
  const gx = Math.floor(gridOriginX);
  const gy = Math.floor(gridOriginY);

  if (!canPlaceBaseBlock(gx, gy, world)) {
    return false;
  }

  const blockId = `base_${gx}_${gy}`;
  const centerWorldX = (gx + 1) * TILE_SIZE;
  const centerWorldY = (gy + 1) * TILE_SIZE;

  let blockRecord = world.baseBlocks.find((b) => b.blockId === blockId);
  if (!blockRecord) {
    blockRecord = {
      blockId,
      gridOriginX: gx,
      gridOriginY: gy,
      worldX: centerWorldX,
      worldY: centerWorldY,
      tileType: blockType,
      hasRespawnPad: blockType === TILE_BASE_RESPAWN,
      stationType: null
    };
    world.baseBlocks.push(blockRecord);
    world.baseBlocks.sort((a, b) => a.blockId.localeCompare(b.blockId));
  } else {
    blockRecord.tileType = blockType;
    blockRecord.hasRespawnPad = blockType === TILE_BASE_RESPAWN;
  }

  return blockRecord;
}

export function upgradeBaseBlockToRespawn(blockRecord, worldState = activeWorldState) {
  if (!blockRecord) return false;
  blockRecord.tileType = TILE_BASE_RESPAWN;
  blockRecord.hasRespawnPad = true;
  return blockRecord;
}

export function getBaseBlockAtWorldPos(worldX, worldY, baseBlocks = []) {
  const halfSpan = TILE_SIZE;
  for (const block of baseBlocks) {
    if (
      Math.abs(worldX - block.worldX) <= halfSpan &&
      Math.abs(worldY - block.worldY) <= halfSpan
    ) {
      return block;
    }
  }
  return null;
}

export function calculateEnemyLoot(enemyTank, playerHP = 100) {
  const drops = [];
  const itemCount = Math.random() < 0.5 ? 1 : 2;

  for (let i = 0; i < itemCount; i++) {
    if (playerHP < 100 && Math.random() < 0.25) {
      drops.push({ type: "hp_orb", label: "+25 HP", quantity: 25 });
      continue;
    }

    const scrapRoll = Math.random();
    if (scrapRoll < 0.5) {
      drops.push({ type: "steel", label: "+1 STEEL", quantity: 1 });
    } else if (scrapRoll < 0.75) {
      drops.push({ type: "copper", label: "+1 COPPER", quantity: 1 });
    } else {
      drops.push({ type: "aluminum", label: "+1 ALUMINUM", quantity: 1 });
    }
  }

  if (Math.random() < 0.25) {
    const cashAmount = Math.floor(Math.random() * 10) + 1;
    drops.push({
      type: "cash",
      label: `+$${cashAmount.toFixed(2)}`,
      quantity: cashAmount
    });
  }

  return drops;
}
