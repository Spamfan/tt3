// Tank Tycoon (prototype 3) - js-state-storage.js (v0.0.1)
// State Storage & Persistence Subsystem (IndexedDB)

export const MODULE_VERSION = "v0.0.1";
export const DB_NAME = "TankTycoonDB";
export const DB_VERSION = 1;

export const STORE_WORLD_CHUNKS = "world_chunks";
export const STORE_PLAYER_STATE = "player_state";
export const STORE_SALVAGE_CRATES = "salvage_crates";
export const STORE_BASE_BLOCKS = "base_blocks";

const SAVE_DEBOUNCE_MS = 5000;

let dbInstance = null;
let saveTimerId = null;
let pendingStateSnapshot = null;

// Fallback memory store when IndexedDB is restricted by browser privacy policy
const memoryFallback = {
  [STORE_WORLD_CHUNKS]: new Map(),
  [STORE_PLAYER_STATE]: new Map(),
  [STORE_SALVAGE_CRATES]: new Map(),
  [STORE_BASE_BLOCKS]: new Map()
};

export function generateWorldSeed() {
  const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `TT3-${randPart}-${timePart}`;
}

export function initStorage() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_WORLD_CHUNKS)) {
          db.createObjectStore(STORE_WORLD_CHUNKS, { keyPath: "chunkKey" });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYER_STATE)) {
          db.createObjectStore(STORE_PLAYER_STATE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SALVAGE_CRATES)) {
          db.createObjectStore(STORE_SALVAGE_CRATES, { keyPath: "crateId" });
        }
        if (!db.objectStoreNames.contains(STORE_BASE_BLOCKS)) {
          db.createObjectStore(STORE_BASE_BLOCKS, { keyPath: "blockId" });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch (_) {
      resolve(null);
    }
  });
}

function serializeGameState(state) {
  const player = state.player || {};
  const world = state.world || {};

  const playerRecord = {
    id: "player_main",
    hp: Number(player.hp ?? 100),
    maxHp: Number(player.maxHp ?? 100),
    cash: Number(player.cash ?? 0),
    steel: Number(player.steel ?? 0),
    copper: Number(player.copper ?? 0),
    aluminum: Number(player.aluminum ?? 0),
    x: Number(player.x ?? 0),
    y: Number(player.y ?? 0),
    chassisAngle: Number(player.chassisAngle ?? 0),
    turretAngle: Number(player.turretAngle ?? 0),
    recipes: Array.isArray(player.recipes) ? [...player.recipes].sort() : [],
    sfxEnabled: player.sfxEnabled !== false,
    worldSeed: String(world.seed || state.worldSeed || generateWorldSeed()),
    armorLevel: Number(player.armorLevel ?? 0),
    specialAbility: player.specialAbility || null,
    chassisCustomization: player.chassisCustomization || {
      hullColor: "#1b4332",
      trimColor: "#00f0ff",
      turretColor: "#2d6a4f",
      decalId: "standard"
    },
    stationSlots: player.stationSlots || {},
    updatedAt: Date.now()
  };

  const chunkRecords = [];
  if (world.chunks && typeof world.chunks.forEach === "function") {
    world.chunks.forEach((chunk) => {
      if (chunk && (chunk.modified || chunk.discovered)) {
        chunkRecords.push({
          chunkKey: `${chunk.chunkX},${chunk.chunkY}`,
          chunkX: chunk.chunkX,
          chunkY: chunk.chunkY,
          tiles: Array.from(chunk.tiles),
          modified: Boolean(chunk.modified),
          clearedEnemies: Boolean(chunk.clearedEnemies)
        });
      }
    });
  }
  chunkRecords.sort((a, b) => a.chunkKey.localeCompare(b.chunkKey));

  const baseRecords = Array.isArray(state.baseBlocks)
    ? state.baseBlocks
        .map((block) => ({
          blockId: String(block.blockId),
          gridOriginX: Number(block.gridOriginX),
          gridOriginY: Number(block.gridOriginY),
          worldX: Number(block.worldX),
          worldY: Number(block.worldY),
          tileType: Number(block.tileType ?? 4),
          hasRespawnPad: Boolean(block.hasRespawnPad),
          stationType: block.stationType || null
        }))
        .sort((a, b) => a.blockId.localeCompare(b.blockId))
    : [];

  const crateRecords = Array.isArray(state.salvageCrates)
    ? state.salvageCrates
        .map((crate) => ({
          crateId: String(crate.crateId),
          x: Number(crate.x),
          y: Number(crate.y),
          cash: Number(crate.cash ?? 0),
          steel: Number(crate.steel ?? 0),
          copper: Number(crate.copper ?? 0),
          aluminum: Number(crate.aluminum ?? 0),
          createdAt: Number(crate.createdAt ?? Date.now())
        }))
        .sort((a, b) => a.crateId.localeCompare(b.crateId))
    : [];

  return { playerRecord, chunkRecords, baseRecords, crateRecords };
}

export async function saveGameState(state, immediate = true) {
  if (!state) return false;

  if (!immediate) {
    pendingStateSnapshot = state;
    if (!saveTimerId) {
      saveTimerId = setTimeout(() => {
        const snapshot = pendingStateSnapshot;
        pendingStateSnapshot = null;
        saveTimerId = null;
        if (snapshot) {
          saveGameState(snapshot, true);
        }
      }, SAVE_DEBOUNCE_MS);
    }
    return true;
  }

  if (saveTimerId) {
    clearTimeout(saveTimerId);
    saveTimerId = null;
    pendingStateSnapshot = null;
  }

  const { playerRecord, chunkRecords, baseRecords, crateRecords } =
    serializeGameState(state);

  const db = await initStorage();
  if (!db) {
    memoryFallback[STORE_PLAYER_STATE].set(playerRecord.id, playerRecord);
    memoryFallback[STORE_WORLD_CHUNKS].clear();
    chunkRecords.forEach((c) =>
      memoryFallback[STORE_WORLD_CHUNKS].set(c.chunkKey, c)
    );
    memoryFallback[STORE_BASE_BLOCKS].clear();
    baseRecords.forEach((b) =>
      memoryFallback[STORE_BASE_BLOCKS].set(b.blockId, b)
    );
    memoryFallback[STORE_SALVAGE_CRATES].clear();
    crateRecords.forEach((cr) =>
      memoryFallback[STORE_SALVAGE_CRATES].set(cr.crateId, cr)
    );
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(
        [
          STORE_PLAYER_STATE,
          STORE_WORLD_CHUNKS,
          STORE_BASE_BLOCKS,
          STORE_SALVAGE_CRATES
        ],
        "readwrite"
      );

      const playerStore = tx.objectStore(STORE_PLAYER_STATE);
      const chunkStore = tx.objectStore(STORE_WORLD_CHUNKS);
      const baseStore = tx.objectStore(STORE_BASE_BLOCKS);
      const crateStore = tx.objectStore(STORE_SALVAGE_CRATES);

      playerStore.put(playerRecord);

      chunkRecords.forEach((rec) => chunkStore.put(rec));

      baseStore.clear();
      baseRecords.forEach((rec) => baseStore.put(rec));

      crateStore.clear();
      crateRecords.forEach((rec) => crateStore.put(rec));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

function readAllFromStore(tx, storeName) {
  return new Promise((resolve) => {
    try {
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

export async function loadGameState() {
  const db = await initStorage();
  if (!db) {
    const player = memoryFallback[STORE_PLAYER_STATE].get("player_main");
    if (!player) return null;
    return {
      player,
      worldSeed: player.worldSeed,
      chunks: Array.from(memoryFallback[STORE_WORLD_CHUNKS].values()),
      baseBlocks: Array.from(memoryFallback[STORE_BASE_BLOCKS].values()),
      salvageCrates: Array.from(memoryFallback[STORE_SALVAGE_CRATES].values())
    };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(
        [
          STORE_PLAYER_STATE,
          STORE_WORLD_CHUNKS,
          STORE_BASE_BLOCKS,
          STORE_SALVAGE_CRATES
        ],
        "readonly"
      );

      Promise.all([
        readAllFromStore(tx, STORE_PLAYER_STATE),
        readAllFromStore(tx, STORE_WORLD_CHUNKS),
        readAllFromStore(tx, STORE_BASE_BLOCKS),
        readAllFromStore(tx, STORE_SALVAGE_CRATES)
      ]).then(([players, chunks, baseBlocks, salvageCrates]) => {
        const player = players.find((p) => p.id === "player_main") || null;
        if (!player) {
          resolve(null);
          return;
        }
        chunks.sort((a, b) => a.chunkKey.localeCompare(b.chunkKey));
        baseBlocks.sort((a, b) => a.blockId.localeCompare(b.blockId));
        salvageCrates.sort((a, b) => a.crateId.localeCompare(b.crateId));
        resolve({
          player,
          worldSeed: player.worldSeed || generateWorldSeed(),
          chunks,
          baseBlocks,
          salvageCrates
        });
      });
    } catch (_) {
      resolve(null);
    }
  });
}

export async function wipeSaveData() {
  if (saveTimerId) {
    clearTimeout(saveTimerId);
    saveTimerId = null;
    pendingStateSnapshot = null;
  }

  memoryFallback[STORE_WORLD_CHUNKS].clear();
  memoryFallback[STORE_PLAYER_STATE].clear();
  memoryFallback[STORE_SALVAGE_CRATES].clear();
  memoryFallback[STORE_BASE_BLOCKS].clear();

  const db = await initStorage();
  if (!db) {
    return generateWorldSeed();
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(
        [
          STORE_WORLD_CHUNKS,
          STORE_PLAYER_STATE,
          STORE_SALVAGE_CRATES,
          STORE_BASE_BLOCKS
        ],
        "readwrite"
      );
      tx.objectStore(STORE_WORLD_CHUNKS).clear();
      tx.objectStore(STORE_PLAYER_STATE).clear();
      tx.objectStore(STORE_SALVAGE_CRATES).clear();
      tx.objectStore(STORE_BASE_BLOCKS).clear();

      tx.oncomplete = () => resolve(generateWorldSeed());
      tx.onerror = () => resolve(generateWorldSeed());
    } catch (_) {
      resolve(generateWorldSeed());
    }
  });
}
