// Tank Tycoon (prototype 3) - js-main.js (v0.0.1)
// Master Coordinator, Fixed-Step Accumulator Loop & Submodule Router

import {
  MODULE_VERSION as MANIFEST_VERSION,
  getManifestData
} from "./js-manifest.js?v=0.0.1";
import {
  initStorage,
  loadGameState,
  saveGameState,
  wipeSaveData,
  generateWorldSeed
} from "./js-state-storage.js?v=0.0.1";
import {
  initPlayerState,
  createEnemyTank,
  craftItem,
  RECIPES
} from "./js-state-player.js?v=0.0.1";
import {
  CHUNK_PIXEL_SIZE,
  TILE_SIZE,
  TILE_BASE_CONCRETE,
  TILE_BASE_RESPAWN,
  initWorld,
  getChunk,
  placeBaseBlock,
  upgradeBaseBlockToRespawn,
  getBaseBlockAtWorldPos
} from "./js-engine-world.js?v=0.0.1";
import {
  updatePhysics
} from "./js-engine-physics.js?v=0.0.1";
import {
  initRenderer,
  renderFrame
} from "./js-engine-render.js?v=0.0.1";
import {
  initUI,
  initInputListeners,
  renderManifest,
  updateHUD,
  showToastBanner
} from "./js-ui-controller.js?v=0.0.1";

export const MODULE_VERSION = "v0.0.1";

function createEventBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      if (listeners.has(event)) listeners.get(event).delete(fn);
    },
    emit(event, payload) {
      if (!listeners.has(event)) return;
      listeners.get(event).forEach((fn) => {
        try {
          fn(payload);
        } catch (_) {}
      });
    }
  };
}

const eventBus = createEventBus();

const gameState = {
  worldSeed: "",
  world: null,
  player: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  particles: [],
  floatingTexts: [],
  baseBlocks: [],
  salvageCrates: [],
  activeBaseBlock: null,
  camera: { x: 0, y: 0 },
  input: {
    moveVector: { x: 0, y: 0 },
    aimAngle: 0,
    isFiring: false,
    leftTouchActive: false,
    pointerScreenX: 0,
    pointerScreenY: 0
  },
  placementState: {
    active: false,
    gridOriginX: 0,
    gridOriginY: 0,
    isValid: true
  },
  accumulator: 0,
  isPaused: false,
  eventBus,
  onImmediateSave: () => {
    saveGameState(gameState, true);
  }
};

function updatePlacementGridFromPlayer() {
  if (!gameState.player) return;
  const angle = gameState.player.turretAngle || 0;
  const dist = TILE_SIZE * 2.2;
  const targetX = gameState.player.x + Math.cos(angle) * dist;
  const targetY = gameState.player.y + Math.sin(angle) * dist;
  gameState.placementState.gridOriginX = Math.floor(targetX / TILE_SIZE) - 1;
  gameState.placementState.gridOriginY = Math.floor(targetY / TILE_SIZE) - 1;
}

function populateNearbyChunkEnemies() {
  if (!gameState.player || !gameState.world) return;
  const pChunkX = Math.floor(gameState.player.x / CHUNK_PIXEL_SIZE);
  const pChunkY = Math.floor(gameState.player.y / CHUNK_PIXEL_SIZE);

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = pChunkX + dx;
      const cy = pChunkY + dy;
      const chunk = getChunk(cx, cy, gameState.world);
      if (
        chunk.isHostile &&
        !chunk.clearedEnemies &&
        !gameState.world.spawnedChunks.has(chunk.chunkKey)
      ) {
        gameState.world.spawnedChunks.add(chunk.chunkKey);
        chunk.enemySpawns.forEach((spawn) => {
          gameState.enemies.push(
            createEnemyTank(spawn.id, spawn.x, spawn.y, chunk.chunkKey)
          );
        });
      }
    }
  }
}

async function hydrateOrCreateWorld(forceFreshSeed = null) {
  await initStorage();
  const saved = forceFreshSeed ? null : await loadGameState();

  const seed = forceFreshSeed || saved?.worldSeed || generateWorldSeed();
  gameState.worldSeed = seed;
  gameState.world = initWorld(seed);
  gameState.player = initPlayerState(saved?.player || null);
  gameState.enemies = [];
  gameState.projectiles = [];
  gameState.pickups = [];
  gameState.particles = [];
  gameState.floatingTexts = [];
  gameState.accumulator = 0;
  gameState.placementState.active = false;

  // Hydrate saved chunk modifications
  if (Array.isArray(saved?.chunks)) {
    saved.chunks.forEach((savedChunk) => {
      const chunk = getChunk(savedChunk.chunkX, savedChunk.chunkY, gameState.world);
      if (Array.isArray(savedChunk.tiles) && savedChunk.tiles.length === chunk.tiles.length) {
        chunk.tiles.set(savedChunk.tiles);
      }
      chunk.modified = Boolean(savedChunk.modified);
      chunk.clearedEnemies = Boolean(savedChunk.clearedEnemies);
    });
  }

  // Hydrate saved Base Blocks
  gameState.baseBlocks = [];
  gameState.world.baseBlocks = gameState.baseBlocks;
  if (Array.isArray(saved?.baseBlocks)) {
    saved.baseBlocks.forEach((b) => {
      const tileType = b.hasRespawnPad ? TILE_BASE_RESPAWN : TILE_BASE_CONCRETE;
      placeBaseBlock(b.gridOriginX, b.gridOriginY, tileType, gameState.world);
    });
  }

  // Hydrate saved Salvage Crates
  gameState.salvageCrates = Array.isArray(saved?.salvageCrates)
    ? [...saved.salvageCrates]
    : [];
  gameState.world.salvageCrates = gameState.salvageCrates;

  gameState.camera.x = gameState.player.x;
  gameState.camera.y = gameState.player.y;

  const seedEl = document.getElementById("hud-seed-readout");
  if (seedEl) {
    seedEl.textContent = `Seed: ${gameState.worldSeed}`;
  }

  await saveGameState(gameState, true);
}

function tryCommitBasePlacement() {
  if (!gameState.placementState.active) return false;
  updatePlacementGridFromPlayer();

  const gx = gameState.placementState.gridOriginX;
  const gy = gameState.placementState.gridOriginY;
  const checkCraft = craftItem(gameState.player, "base_block");
  if (!checkCraft.ok) {
    showToastBanner(checkCraft.reason);
    gameState.placementState.active = false;
    return false;
  }

  const placed = placeBaseBlock(gx, gy, TILE_BASE_CONCRETE, gameState.world);
  if (!placed) {
    // Refund 10 Steel if blocked by water
    gameState.player.steel += RECIPES.base_block.costSteel;
    showToastBanner("CANNOT BUILD BASE SLAB ON WATER");
    return true;
  }

  gameState.placementState.active = false;
  saveGameState(gameState, true);
  updateHUD(gameState);
  showToastBanner("2x2 BASE CONCRETE SLAB DEPLOYED");
  return true;
}

function handleContextualInteract() {
  if (gameState.placementState.active) {
    tryCommitBasePlacement();
    return;
  }

  const activeBlock = gameState.activeBaseBlock;
  if (!activeBlock) return;

  if (activeBlock.hasRespawnPad) {
    showToastBanner("RESPAWN PAD ONLINE • TELEPORT ANCHORED");
    return;
  }

  const res = craftItem(gameState.player, "respawn_pad", activeBlock);
  if (!res.ok) {
    showToastBanner(res.reason.toUpperCase());
    return;
  }

  upgradeBaseBlockToRespawn(activeBlock, gameState.world);
  saveGameState(gameState, true);
  updateHUD(gameState);
  showToastBanner("RESPAWN PAD UPGRADE COMPLETE");
}

async function bootApp() {
  const canvas = document.getElementById("game-canvas");
  initRenderer(canvas);

  await hydrateOrCreateWorld();

  initUI(eventBus, {
    getGameState: () => gameState,
    onPauseStateChange: (paused) => {
      gameState.isPaused = paused;
    },
    onStartBasePlacement: () => {
      if ((gameState.player?.steel || 0) < 10) {
        showToastBanner("REQUIRES 10 STEEL TO CRAFT BASE BLOCK");
        return false;
      }
      gameState.placementState.active = true;
      updatePlacementGridFromPlayer();
      return true;
    },
    onCancelPlacement: () => {
      if (gameState.placementState.active) {
        gameState.placementState.active = false;
        return true;
      }
      return false;
    },
    onInteractTrigger: handleContextualInteract,
    onToggleSfx: () => {
      gameState.player.sfxEnabled = !gameState.player.sfxEnabled;
      saveGameState(gameState, false);
      return gameState.player.sfxEnabled;
    },
    onResetWorld: async () => {
      const newSeed = await wipeSaveData();
      await hydrateOrCreateWorld(newSeed);
      updateHUD(gameState);
    }
  });

  renderManifest(getManifestData());

  initInputListeners(canvas, gameState.input, {
    onPointerWorldMove: (screenX, screenY) => {
      if (!gameState.placementState.active) return;
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      const worldX = screenX - halfW + gameState.camera.x;
      const worldY = screenY - halfH + gameState.camera.y;
      gameState.placementState.gridOriginX = Math.floor(worldX / TILE_SIZE) - 1;
      gameState.placementState.gridOriginY = Math.floor(worldY / TILE_SIZE) - 1;
    },
    onCanvasPrimaryAction: () => {
      if (gameState.placementState.active) {
        return tryCommitBasePlacement();
      }
      return false;
    }
  });

  // Remove loading shimmer skeleton once hydrated
  document.querySelectorAll(".skeleton-box").forEach((el) => {
    el.classList.remove("skeleton-box");
  });

  let lastTime = performance.now();
  let hudTickCounter = 0;

  function frameLoop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (!gameState.isPaused) {
      populateNearbyChunkEnemies();
      if (gameState.placementState.active && gameState.input.leftTouchActive) {
        updatePlacementGridFromPlayer();
      }
      const alpha = updatePhysics(dt, gameState);
      gameState.activeBaseBlock = getBaseBlockAtWorldPos(
        gameState.player.x,
        gameState.player.y,
        gameState.baseBlocks
      );
      renderFrame(gameState, alpha);

      hudTickCounter++;
      if (hudTickCounter % 4 === 0) {
        updateHUD(gameState);
      }
      if (hudTickCounter % 300 === 0) {
        saveGameState(gameState, false);
      }
    } else {
      renderFrame(gameState, 1);
    }

    requestAnimationFrame(frameLoop);
  }

  updateHUD(gameState);
  requestAnimationFrame(frameLoop);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", bootApp);
}
export { MANIFEST_VERSION };
