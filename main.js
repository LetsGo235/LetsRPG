// -------------------------
// INPUT
// -------------------------
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  const confirmKeys = ["Enter", " ", "z", "Z"];
  const isConfirm = confirmKeys.includes(e.key);

  // Toggle inventory (overworld only, not during cutscenes)
  if (
    !inventoryState.open &&
    gameState === "overworld" &&
    !cutscene.active &&
    (e.key === "i" || e.key === "I")
  ) {
    e.preventDefault();
    inventoryState.open = true;
    if (inventory.length === 0) {
      setMessage("Your inventory is empty.");
    } else {
      setMessage("You open your inventory.");
    }
    return;
  }

  // Inventory open: handle its keys first
  if (inventoryState.open && gameState === "overworld") {
    if (isConfirm && messageState.playing) {
      e.preventDefault();
      completeMessageInstantly();
      return;
    }
    handleInventoryKey(e);
    return;
  }

  // Global text gating (works even during cutscenes)
  if (isConfirm) {
    if (messageState.playing) {
      e.preventDefault();
      completeMessageInstantly();
      return;
    } else if (pendingNextAction) {
      e.preventDefault();
      const next = pendingNextAction;
      pendingNextAction = null;
      next();
      return;
    }
  }

  // Overworld interact (blocked during cutscenes)
  if (gameState === "overworld" && !cutscene.active && isConfirm) {
    e.preventDefault();
    if (!transition.active) {
      tryTalkToNpc();
    }
    return;
  }

  // Battle input
  if (gameState === "battle" && battleState) {
    // Attack timing bar confirm
    if (battleState.phase === "attackQTE" && isConfirm) {
      e.preventDefault();
      handleQteConfirm();
      return;
    }

    // Battle item menu navigation
    if (battleState.phase === "itemMenu") {
      handleBattleItemKey(e);
      return;
    }

    // Menu / target navigation
    if (battleState.phase === "playerTurn") {
      // Duo target switching with Q/E
      if (
        battleState.duo &&
        (e.key === "q" ||
          e.key === "Q" ||
          e.key === "e" ||
          e.key === "E")
      ) {
        e.preventDefault();
        const d = battleState.duo;
        let idx = d.targetIndex;
        idx = (idx + 1) % d.names.length;
        if (d.hp[idx] <= 0) {
          const other = idx === 0 ? 1 : 0;
          if (d.hp[other] > 0) idx = other;
        }
        d.targetIndex = idx;
        return;
      }

      const leftKeys = ["ArrowLeft", "a", "A", "ArrowUp", "w", "W"];
      const rightKeys = ["ArrowRight", "d", "D", "ArrowDown", "s", "S"];

      if (leftKeys.includes(e.key)) {
        e.preventDefault();
        menuIndex = (menuIndex + buttons.length - 1) % buttons.length;
        updateMenuHighlight();
        playSfx(sfxMenuMove);
      } else if (rightKeys.includes(e.key)) {
        e.preventDefault();
        menuIndex = (menuIndex + 1) % buttons.length;
        updateMenuHighlight();
        playSfx(sfxMenuMove);
      } else if (isConfirm) {
        e.preventDefault();
        const btn = buttons[menuIndex];
        if (btn) {
          playSfx(sfxMenuConfirm);
          handlePlayerAction(btn.dataset.action);
        }
      }
    }
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// Also keep the button click handlers for the battle menu here:
buttons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    menuIndex = index;
    updateMenuHighlight();
    playSfx(sfxMenuConfirm);
    handlePlayerAction(btn.dataset.action);
  });
});

// -------------------------
// MAIN LOOP
// -------------------------
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (doorCooldown > 0) {
    doorCooldown -= dt;
    if (doorCooldown < 0) doorCooldown = 0;
  }

  updateQuestObjects();

  if (gameState === "overworld") {
    updateTransition(dt);
    if (!transition.active) {
      updateOverworld(dt);
    }
    updateCamera();
    drawOverworld();
  } else if (gameState === "battle") {
    updateBattle(dt);
    drawBattle();
  }

  updateMessage(dt);
  requestAnimationFrame(loop);
}

// Initial setup
menuEl.style.display = "none";
menuIndex = 0;
updateMenuHighlight();

const startRoom = getCurrentRoom();
if (startRoom) {
  hero.x = startRoom.spawnX || canvas.width / 2;
  hero.y = startRoom.spawnY || canvas.height - 80;
}
updateCamera();

addItem("fists", 1);
addItem("clothes", 1);
addItem("snack", 1);

setMessage(
  "Move with arrows / WASD.\nTalk to Dummy to fight.\nPress I for inventory.\nUse Save/Load at the top."
);

requestAnimationFrame(loop);
