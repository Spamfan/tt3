// Tank Tycoon (prototype 3) - js-engine-world.js (v0.0.1)
// World Generation, Seeded Chunking, Base Placement & Loot Subsystem

export const MODULE_VERSION = "v0.0.1";

export const CHUNK_TILES = 16;
export const TILE_SIZE = 48;
export const CHUNK_PIXEL_SIZE = CHUNK_TILES * TILE_SIZE; // 768px

// Core Tile IDs
export const TILE_GRASS = 0;
export const TILE_DIRT = 1;
export const TILE_SAND = 2;
export const TILE_WATER = 3;
export const TILE_BASE_CONCRETE = 4;
export const TILE_BASE_RESPAWN = 5;

// Reserved Biome ID Ranges (md-spec-world.md §2)
export const BIOME_DESERT_MIN = 10;
export const BIOME_DESERT_MAX = 19;
export const BIOME_WASTELAND_MIN = 20;
export const BIOME_WASTELAND_MAX = 29;

// Forward Base Station Schema Hooks (md-spec-world.md §4)
export const STATION_INCOME = 10;
export const STATION_REPAIR = 11;
export const STATION_GARAGE = 12;
export const STATION_TURRET = 13;

export const TILE_PROPERTIES = Object.freeze({
  [TILE_GRASS]: { speed: 1.0, passable: true, buildable: true, name: "Grass" },
  [TILE_DIRT]: { speed: 1.0, passable: true, buildable: true, name: "Dirt" },
  [TILE_SAND]: { speed: 0.7, passable: true, buildable: true, name: "Sand" },
  [TILE_WATER]: { speed: 0.25, passable: true, buildable: false, name: "Water" },
  [TILE_BASE_CONCRETE]: {
    speed: 1.0,
    passable: true,
    buildable: true,
    name: "Base Concrete"
  },
  [TILE_BASE_RESPAWN]: {
    speed: 1.0,
    passable: true,
    buildable: false,
    name: "Respawn Pad"
  }
});

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

  const tiles = new Uint8Array(CHUNK_TILES * CHUNK_TILES);
  const radius = Math.sqrt(chunkX * chunkX + chunkY * chunkY);

  for (let ty = 0; ty < CHUNK_TILES; ty++) {
    for (let tx = 0; tx < CHUNK_TILES; tx++) {
      const worldTileX = chunkX * CHUNK_TILES + tx;
      const worldTileY = chunkY * CHUNK_TILES + ty;
      const distFromOriginTiles = Math.hypot(worldTileX, worldTileY);

      // Guaranteed dry clearing around spawn (0, 0)
      if (distFromOriginTiles < 5) {
        tiles[ty * CHUNK_TILES + tx] = TILE_GRASS;
        continue;
      }

      const elevation =
        valueNoise2D(worldTileX, worldTileY, 10.5, world.seedInt) * 0.7 +
        valueNoise2D(worldTileX, worldTileY, 4.2, world.seedInt ^ 0x9e3779b9) * 0.3;

      const pathNoise = valueNoise2D(
        worldTileX + 100,
        worldTileY - 100,
        7.0,
        world.seedInt ^ 0x85ebca6b
      );

      let tileId = TILE_GRASS;
      if (elevation < 0.23) {
        tileId = TILE_WATER;
      } else if (elevation < 0.31) {
        tileId = TILE_SAND;
      } else if (pathNoise > 0.47 && pathNoise < 0.53) {
        tileId = TILE_DIRT;
      } else {
        tileId = TILE_GRASS;
      }

      tiles[ty * CHUNK_TILES + tx] = tileId;
    }
  }

  // Generate deterministic enemy spawn candidates if in Hostile Zone (radius > 2)
  const enemySpawns = [];
  if (radius > 2) {
    const countRoll = coordHash(chunkX, chunkY, world.seedInt ^ 0xc2b2ae35);
    // 1 to 3 enemies per hostile chunk, scaling slightly with radius
    const groupSize =
      countRoll < 0.4 ? 1 : countRoll < 0.8 ? 2 : 3;

    for (let i = 0; i < groupSize; i++) {
      const rx = Math.floor(
        coordHash(chunkX * 31 + i, chunkY * 17 + i, world.seedInt) *
          (CHUNK_TILES - 4)
      ) + 2;
      const ry = Math.floor(
        coordHash(chunkX * 19 + i, chunkY * 29 + i, world.seedInt ^ 0x27d4eb2f) *
          (CHUNK_TILES - 4)
      ) + 2;
      const idx = ry * CHUNK_TILES + rx;
      if (tiles[idx] === TILE_WATER) {
        tiles[idx] = TILE_GRASS;
      }
      const worldX = (chunkX * CHUNK_TILES + rx + 0.5) * TILE_SIZE;
      const worldY = (chunkY * CHUNK_TILES + ry + 0.5) * TILE_SIZE;
      enemySpawns.push({
        id: `foe_${chunkX}_${chunkY}_${i}`,
        x: worldX,
        y: worldY,
        chunkKey: key
      });
    }
  }

  const chunk = {
    chunkKey: key,
    chunkX,
    chunkY,
    radius,
    isHostile: radius > 2,
    tiles,
    enemySpawns,
    modified: false,
    discovered: true,
    clearedEnemies: false
  };

  world.chunks.set(key, chunk);
  return chunk;
}

export function worldPosToTileCoords(worldX, worldY) {
  const worldTileX = Math.floor(worldX / TILE_SIZE);
  const worldTileY = Math.floor(worldY / TILE_SIZE);
  const chunkX = Math.floor(worldTileX / CHUNK_TILES);
  const chunkY = Math.floor(worldTileY / CHUNK_TILES);
  const tileX = ((worldTileX % CHUNK_TILES) + CHUNK_TILES) % CHUNK_TILES;
  const tileY = ((worldTileY % CHUNK_TILES) + CHUNK_TILES) % CHUNK_TILES;
  return { worldTileX, worldTileY, chunkX, chunkY, tileX, tileY };
}

export function getTileAtWorldPos(worldX, worldY, worldState = activeWorldState) {
  const world = worldState || getActiveWorld();
  const { worldTileX, worldTileY, chunkX, chunkY, tileX, tileY } =
    worldPosToTileCoords(worldX, worldY);
  const chunk = getChunk(chunkX, chunkY, world);
  const tileId = chunk.tiles[tileY * CHUNK_TILES + tileX];
  const props = TILE_PROPERTIES[tileId] || TILE_PROPERTIES[TILE_GRASS];

  return {
    tileId,
    speedMultiplier: props.speed,
    passable: props.passable,
    buildable: props.buildable,
    chunkX,
    chunkY,
    tileX,
    tileY,
    worldTileX,
    worldTileY
  };
}

export function setTileAtWorldTile(
  worldTileX,
  worldTileY,
  tileId,
  worldState = activeWorldState
) {
  const world = worldState || getActiveWorld();
  const chunkX = Math.floor(worldTileX / CHUNK_TILES);
  const chunkY = Math.floor(worldTileY / CHUNK_TILES);
  const tileX = ((worldTileX % CHUNK_TILES) + CHUNK_TILES) % CHUNK_TILES;
  const tileY = ((worldTileY % CHUNK_TILES) + CHUNK_TILES) % CHUNK_TILES;
  const chunk = getChunk(chunkX, chunkY, world);
  chunk.tiles[tileY * CHUNK_TILES + tileX] = tileId;
  chunk.modified = true;
}

export function canPlaceBaseBlock(
  gridOriginX,
  gridOriginY,
  worldState = activeWorldState
) {
  const world = worldState || getActiveWorld();
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const wx = (gridOriginX + dx + 0.5) * TILE_SIZE;
      const wy = (gridOriginY + dy + 0.5) * TILE_SIZE;
      const tile = getTileAtWorldPos(wx, wy, world);
      if (
        tile.tileId === TILE_WATER ||
        tile.tileId === TILE_BASE_CONCRETE ||
        tile.tileId === TILE_BASE_RESPAWN
      ) {
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

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const wx = (gx + dx + 0.5) * TILE_SIZE;
      const wy = (gy + dy + 0.5) * TILE_SIZE;
      const tile = getTileAtWorldPos(wx, wy, world);
      if (tile.tileId === TILE_WATER) {
        return false;
      }
    }
  }

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      setTileAtWorldTile(gx + dx, gy + dy, blockType, world);
    }
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

export function upgradeBaseBlockToRespawn(
  blockRecord,
  worldState = activeWorldState
) {
  if (!blockRecord) return false;
  return placeBaseBlock(
    blockRecord.gridOriginX,
    blockRecord.gridOriginY,
    TILE_BASE_RESPAWN,
    worldState
  );
}

export function getBaseBlockAtWorldPos(
  worldX,
  worldY,
  baseBlocks = []
) {
  const halfSpan = TILE_SIZE; // 2x2 tiles = 96x96px -> radius 48px from center
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
      drops.push({
        type: "hp_orb",
        label: "+25 HP",
        quantity: 25
      });
      continue;
    }

    const scrapRoll = Math.random();
    if (scrapRoll < 0.5) {
      drops.push({
        type: "steel",
        label: "+1 STEEL",
        quantity: 1
      });
    } else if (scrapRoll < 0.75) {
      drops.push({
        type: "copper",
        label: "+1 COPPER",
        quantity: 1
      });
    } else {
      drops.push({
        type: "aluminum",
        label: "+1 ALUMINUM",
        quantity: 1
      });
    }
  }

  // Separate 25% roll for $1.00 - $10.00 Cash
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
