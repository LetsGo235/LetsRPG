// -------------------------
// SAVE / LOAD SYSTEM
// -------------------------
const SAVE_MAGIC = "MiniUT_SAVE";
const SAVE_VERSION = 1;

function buildSaveData() {
  return {
    meta: {
      magic: SAVE_MAGIC,
      version: SAVE_VERSION,
      timestamp: Date.now()
    },
    player: {
      currentRoomId,
      heroX: hero.x,
      heroY: hero.y,
      hp: heart.hp,
      maxHp: heart.maxHp,
      weaponId: equipment.weaponId,
      armorId: equipment.armorId
    },
    quests: { ...questState },
    inventory: inventory.map((it) => ({ id: it.id, quantity: it.quantity }))
  };
}

function applySaveData(data) {
  // (full body as you have it now – unchanged)
}

function saveGameToFile() {
  // (unchanged)
}

function handleLoadFile(event) {
  // (unchanged)
}

saveBtn.addEventListener("click", saveGameToFile);
loadInput.addEventListener("change", handleLoadFile);
