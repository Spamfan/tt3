// Tank Tycoon (prototype 3) - js-ui-controller.js (v0.0.3)
// UI, HUD, Split-Screen Touch Input, 4-Way Modal Dismissal & Manifest Table

import { TILE_SIZE } from "./js-engine-world.js?v=0.0.3";
import {
  EVENT_RECIPE_UNLOCKED,
  EVENT_GAME_OVER,
  EVENT_PLAYER_RESPAWN,
  EVENT_INVENTORY_UPDATED
} from "./js-state-player.js?v=0.0.1";

export const MODULE_VERSION = "v0.0.3";

let activeModalStack = [];
let onModalPauseStateChange = null;
let uiRefs = {};

export function toggleFullscreen() {
  if (typeof document === "undefined") return;
  const docEl = document.documentElement;
  const isFull =
    document.fullscreenElement || document.webkitFullscreenElement;

  if (!isFull) {
    document.body.classList.add("is-fullscreen");
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    }
  } else {
    document.body.classList.remove("is-fullscreen");
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function syncPauseState() {
  if (typeof onModalPauseStateChange === "function") {
    onModalPauseStateChange(activeModalStack.length > 0);
  }
}

export function openModal(modalElement) {
  if (!modalElement) return;
  modalElement.classList.add("is-open");
  modalElement.setAttribute("aria-hidden", "false");

  if (!activeModalStack.includes(modalElement)) {
    activeModalStack.push(modalElement);
    try {
      window.history.pushState(
        { tt3ModalId: modalElement.id || "modal" },
        "",
        window.location.href
      );
    } catch (_) {}
  }

  syncPauseState();
}

export function closeModal(modalElement, fromPopState = false) {
  if (!modalElement || !modalElement.classList.contains("is-open")) return;
  modalElement.classList.remove("is-open");
  modalElement.setAttribute("aria-hidden", "true");

  const idx = activeModalStack.indexOf(modalElement);
  if (idx !== -1) {
    activeModalStack.splice(idx, 1);
  }

  if (!fromPopState) {
    try {
      if (window.history.state && window.history.state.tt3ModalId) {
        window.history.back();
      }
    } catch (_) {}
  }

  syncPauseState();
}

export function closeAllModals() {
  const count = activeModalStack.length;
  while (activeModalStack.length > 0) {
    const top = activeModalStack.pop();
    if (top) {
      top.classList.remove("is-open");
      top.setAttribute("aria-hidden", "true");
    }
  }
  if (count > 0) {
    try {
      if (window.history.state && window.history.state.tt3ModalId) {
        window.history.go(-count);
      }
    } catch (_) {}
  }
  syncPauseState();
}

export function renderManifest(manifestData = []) {
  const sorted = [...manifestData].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  const containers = document.querySelectorAll("[data-manifest-tbody]");
  containers.forEach((tbody) => {
    tbody.innerHTML = "";
    sorted.forEach((entry) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.textContent = entry.name;
      const tdVer = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "manifest-badge";
      badge.textContent = entry.version;
      tdVer.appendChild(badge);
      tr.appendChild(tdName);
      tr.appendChild(tdVer);
      tbody.appendChild(tr);
    });
  });
}

export function updateHUD(gameState) {
  if (!gameState || !gameState.player) return;
  const player = gameState.player;

  if (uiRefs.healthFill) {
    const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    uiRefs.healthFill.style.width = `${pct}%`;
  }
  if (uiRefs.healthText) {
    uiRefs.healthText.textContent = `${player.hp}/${player.maxHp}`;
  }
  if (uiRefs.cashText) {
    uiRefs.cashText.textContent = `$${Number(player.cash || 0).toFixed(2)}`;
  }
  if (uiRefs.steelCount) {
    uiRefs.steelCount.textContent = String(player.steel || 0);
  }
  if (uiRefs.copperCount) {
    uiRefs.copperCount.textContent = String(player.copper || 0);
  }
  if (uiRefs.aluminumCount) {
    uiRefs.aluminumCount.textContent = String(player.aluminum || 0);
  }
  if (uiRefs.invBadge) {
    const totalScrap =
      (player.steel || 0) + (player.copper || 0) + (player.aluminum || 0);
    uiRefs.invBadge.textContent = String(totalScrap);
  }

  // Update Craft Base Block button state in Inventory modal
  if (uiRefs.btnCraftBase) {
    const canCraft = (player.steel || 0) >= 10;
    uiRefs.btnCraftBase.disabled = !canCraft;
    uiRefs.btnCraftBase.textContent = canCraft
      ? "Deploy 2x2 Base Slab (10 Steel)"
      : `Locked: Need 10 Steel (${player.steel || 0}/10)`;
  }

  // Contextual bottom-right .hud-btn-interact when standing on a Base Block
  if (uiRefs.btnInteract) {
    const activeBlock = gameState.activeBaseBlock || null;
    if (gameState.placementState?.active) {
      uiRefs.btnInteract.classList.add("is-visible");
      uiRefs.btnInteractLabel.textContent = gameState.placementState.isValid
        ? "PLACE BASE SLAB"
        : "INVALID TERRAIN";
    } else if (activeBlock) {
      uiRefs.btnInteract.classList.add("is-visible");
      if (activeBlock.hasRespawnPad) {
        uiRefs.btnInteractLabel.textContent = "RESPAWN PAD ACTIVE";
      } else {
        uiRefs.btnInteractLabel.textContent = "UPGRADE RESPAWN (5 STEEL + $25)";
      }
    } else {
      uiRefs.btnInteract.classList.remove("is-visible");
    }
  }
}

export function showToastBanner(message) {
  if (!uiRefs.toastBanner) return;
  uiRefs.toastBanner.textContent = message;
  uiRefs.toastBanner.classList.add("is-visible");
  clearTimeout(uiRefs.toastTimer);
  uiRefs.toastTimer = setTimeout(() => {
    uiRefs.toastBanner.classList.remove("is-visible");
  }, 2600);
}

export function initUI(eventBus, actions = {}) {
  onModalPauseStateChange = actions.onPauseStateChange || null;

  uiRefs = {
    versionBtn: document.querySelector(".hud-version"),
    healthFill: document.querySelector(".hud-health-fill"),
    healthText: document.querySelector(".hud-health-text"),
    cashText: document.querySelector(".hud-cash"),
    btnInventory: document.querySelector(".hud-btn-inventory"),
    invBadge: document.querySelector(".hud-inv-badge"),
    btnPause: document.querySelector(".hud-btn-pause"),
    btnInteract: document.querySelector(".hud-btn-interact"),
    btnInteractLabel: document.querySelector(".hud-btn-interact-label"),
    modalPause: document.querySelector(".modal-pause"),
    modalManifest: document.querySelector(".modal-manifest"),
    modalInventory: document.querySelector(".modal-inventory"),
    modalConfirmReset: document.querySelector(".modal-confirm-reset"),
    modalGameOver: document.querySelector(".modal-gameover"),
    steelCount: document.getElementById("inv-steel-count"),
    copperCount: document.getElementById("inv-copper-count"),
    aluminumCount: document.getElementById("inv-aluminum-count"),
    btnCraftBase: document.getElementById("btn-craft-base"),
    btnSfxToggle: document.getElementById("btn-sfx-toggle"),
    btnFullscreen: document.getElementById("btn-fullscreen-toggle"),
    btnOpenResetModal: document.getElementById("btn-open-reset-modal"),
    btnConfirmReset: document.getElementById("btn-confirm-reset"),
    btnGameOverReset: document.getElementById("btn-gameover-reset"),
    seedReadout: document.getElementById("hud-seed-readout"),
    toastBanner: document.getElementById("hud-toast-banner"),
    joystickRing: document.getElementById("joystick-ring"),
    joystickNub: document.getElementById("joystick-nub")
  };

  // Top-left discrete v0.0.1 tap -> open Repo Manifest modal
  if (uiRefs.versionBtn) {
    uiRefs.versionBtn.addEventListener("click", () => {
      openModal(uiRefs.modalManifest);
    });
  }

  // Top-right Pause button (||)
  if (uiRefs.btnPause) {
    uiRefs.btnPause.addEventListener("click", () => {
      openModal(uiRefs.modalPause);
    });
  }

  // Top-center Inventory pouch button
  if (uiRefs.btnInventory) {
    uiRefs.btnInventory.addEventListener("click", () => {
      if (actions.getGameState) {
        updateHUD(actions.getGameState());
      }
      openModal(uiRefs.modalInventory);
    });
  }

  // Craft & Place Base Block inside Inventory modal
  if (uiRefs.btnCraftBase) {
    uiRefs.btnCraftBase.addEventListener("click", () => {
      if (actions.onStartBasePlacement) {
        const started = actions.onStartBasePlacement();
        if (started) {
          closeModal(uiRefs.modalInventory);
          showToastBanner("PLACEMENT MODE: TAP OR CLICK TO PLACE 2x2 BASE");
        }
      }
    });
  }

  // Contextual bottom-right Interact button
  if (uiRefs.btnInteract) {
    uiRefs.btnInteract.addEventListener("click", () => {
      if (actions.onInteractTrigger) {
        actions.onInteractTrigger();
      }
    });
  }

  // SFX State-Only Stub Toggle in Pause Modal
  if (uiRefs.btnSfxToggle) {
    uiRefs.btnSfxToggle.addEventListener("click", () => {
      if (actions.onToggleSfx) {
        const enabled = actions.onToggleSfx();
        uiRefs.btnSfxToggle.textContent = enabled
          ? "SFX Audio: ON (Stub)"
          : "SFX Audio: MUTED (Stub)";
      }
    });
  }

  // Fullscreen Toggle in Pause Modal Settings
  if (uiRefs.btnFullscreen) {
    uiRefs.btnFullscreen.addEventListener("click", () => {
      toggleFullscreen();
    });
  }

  // Caution "Reset World" -> Opens Custom Confirmation Modal
  if (uiRefs.btnOpenResetModal) {
    uiRefs.btnOpenResetModal.addEventListener("click", () => {
      openModal(uiRefs.modalConfirmReset);
    });
  }

  if (uiRefs.btnConfirmReset) {
    uiRefs.btnConfirmReset.addEventListener("click", async () => {
      if (actions.onResetWorld) {
        await actions.onResetWorld();
      }
      closeAllModals();
      showToastBanner("WORLD RESET: NEW RANDOM SEED INITIALIZED");
    });
  }

  if (uiRefs.btnGameOverReset) {
    uiRefs.btnGameOverReset.addEventListener("click", async () => {
      if (actions.onResetWorld) {
        await actions.onResetWorld();
      }
      closeAllModals();
      showToastBanner("NEW DEPLOYMENT READY");
    });
  }

  // 4-Way Modal Dismissal: Close buttons & Backdrop taps
  document.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parentModal = btn.closest(".modal-backdrop");
      if (parentModal) closeModal(parentModal);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // Escape key dismissal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (activeModalStack.length > 0) {
        const topModal = activeModalStack[activeModalStack.length - 1];
        closeModal(topModal);
      } else if (actions.onCancelPlacement && actions.onCancelPlacement()) {
        showToastBanner("BASE PLACEMENT CANCELED");
      } else {
        openModal(uiRefs.modalPause);
      }
    }
  });

  // Browser back button / popstate trapping
  window.addEventListener("popstate", () => {
    if (activeModalStack.length > 0) {
      const topModal = activeModalStack[activeModalStack.length - 1];
      closeModal(topModal, true);
    }
  });

  // Domain Event Subscriptions
  if (eventBus && typeof eventBus.on === "function") {
    eventBus.on(EVENT_RECIPE_UNLOCKED, (payload) => {
      showToastBanner(`RECIPE UNLOCKED: ${payload?.recipe?.name || "BASE BLOCK"}`);
    });
    eventBus.on(EVENT_PLAYER_RESPAWN, () => {
      showToastBanner("RESPAWNED AT ACTIVE PAD • SALVAGE CRATE DROPPED");
    });
    eventBus.on(EVENT_GAME_OVER, () => {
      openModal(uiRefs.modalGameOver);
    });
    eventBus.on(EVENT_INVENTORY_UPDATED, ({ player }) => {
      if (player && actions.getGameState) {
        updateHUD(actions.getGameState());
      }
    });
  }

  return uiRefs;
}

export function initInputListeners(canvasElement, inputState, callbacks = {}) {
  const keysPressed = new Set();

  function recomputeKeyboardVector() {
    let x = 0;
    let y = 0;
    if (keysPressed.has("KeyW") || keysPressed.has("ArrowUp")) y -= 1;
    if (keysPressed.has("KeyS") || keysPressed.has("ArrowDown")) y += 1;
    if (keysPressed.has("KeyA") || keysPressed.has("ArrowLeft")) x -= 1;
    if (keysPressed.has("KeyD") || keysPressed.has("ArrowRight")) x += 1;

    const len = Math.hypot(x, y);
    if (len > 0) {
      inputState.moveVector.x = x / len;
      inputState.moveVector.y = y / len;
    } else if (!inputState.leftTouchActive) {
      inputState.moveVector.x = 0;
      inputState.moveVector.y = 0;
    }
  }

  window.addEventListener("keydown", (e) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      keysPressed.add(e.code);
      recomputeKeyboardVector();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (keysPressed.has(e.code)) {
      keysPressed.delete(e.code);
      recomputeKeyboardVector();
    }
  });

  // Desktop Pointer Aim & Primary Fire / Placement
  if (canvasElement) {
    canvasElement.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const rect = canvasElement.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = e.clientX - rect.left - cx;
      const dy = e.clientY - rect.top - cy;
      inputState.aimAngle = Math.atan2(dy, dx);
      inputState.pointerScreenX = e.clientX - rect.left;
      inputState.pointerScreenY = e.clientY - rect.top;

      if (callbacks.onPointerWorldMove) {
        callbacks.onPointerWorldMove(
          inputState.pointerScreenX,
          inputState.pointerScreenY
        );
      }
    });

    canvasElement.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      if (e.button === 0) {
        if (callbacks.onCanvasPrimaryAction) {
          const consumed = callbacks.onCanvasPrimaryAction(
            e.clientX,
            e.clientY
          );
          if (consumed) return;
        }
        inputState.isFiring = true;
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return;
      if (e.button === 0) {
        inputState.isFiring = false;
      }
    });
  }

  // Mobile Split-Screen Touch Controls (Left Drive Stick / Right Aim & Auto-Fire)
  let leftTouchId = null;
  let leftOriginX = 0;
  let leftOriginY = 0;
  let rightTouchId = null;
  let rightOriginX = 0;
  let rightOriginY = 0;
  const maxStickRadius = TILE_SIZE; // 48px

  const handleTouchStart = (e) => {
    if (activeModalStack.length > 0) return;
    const halfScreen = window.innerWidth / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < halfScreen && leftTouchId === null) {
        leftTouchId = t.identifier;
        leftOriginX = t.clientX;
        leftOriginY = t.clientY;
        inputState.leftTouchActive = true;

        if (uiRefs.joystickRing && uiRefs.joystickNub) {
          uiRefs.joystickRing.style.display = "block";
          uiRefs.joystickRing.style.left = `${leftOriginX}px`;
          uiRefs.joystickRing.style.top = `${leftOriginY}px`;
          uiRefs.joystickNub.style.transform = `translate(0px, 0px)`;
        }
      } else if (t.clientX >= halfScreen && rightTouchId === null) {
        rightTouchId = t.identifier;
        rightOriginX = t.clientX;
        rightOriginY = t.clientY;
        inputState.isFiring = true;
      }
    }
  };

  const handleTouchMove = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === leftTouchId) {
        const dx = t.clientX - leftOriginX;
        const dy = t.clientY - leftOriginY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(maxStickRadius, dist);
        const nx = dist > 0.001 ? dx / dist : 0;
        const ny = dist > 0.001 ? dy / dist : 0;

        inputState.moveVector.x = nx * (clamped / maxStickRadius);
        inputState.moveVector.y = ny * (clamped / maxStickRadius);

        if (uiRefs.joystickNub) {
          uiRefs.joystickNub.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
        }
      } else if (t.identifier === rightTouchId) {
        const dx = t.clientX - rightOriginX;
        const dy = t.clientY - rightOriginY;
        if (Math.hypot(dx, dy) > 6) {
          inputState.aimAngle = Math.atan2(dy, dx);
        }
        inputState.isFiring = true;
      }
    }
  };

  const handleTouchEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === leftTouchId) {
        leftTouchId = null;
        inputState.leftTouchActive = false;
        recomputeKeyboardVector();
        if (uiRefs.joystickRing) {
          uiRefs.joystickRing.style.display = "none";
        }
      } else if (t.identifier === rightTouchId) {
        rightTouchId = null;
        inputState.isFiring = false;
      }
    }
  };

  if (canvasElement) {
    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvasElement.addEventListener("touchend", handleTouchEnd, { passive: true });
    canvasElement.addEventListener("touchcancel", handleTouchEnd, { passive: true });
  }
}
