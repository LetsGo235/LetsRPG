// world.js

const itemDefs   = window.gameData.items;
const rooms      = window.gameData.rooms;
const tilesets   = window.gameData.tilesets || {};
const decorDefs  = window.gameData.decorDefs || {};

const tilesetImages = {};

// Call this once during world init
function initTilesets() {
  Object.keys(tilesets).forEach(id => {
    const ts = tilesets[id];
    if (!ts || !ts.image) return;
    const img = new Image();
    img.src = ts.image;
    tilesetImages[id] = img;
    ts.imageObj = img;
  });
}

// (then the rest of world.js as you already have it: questState, inventory, hero, etc.)

// -------------------------
// CUTSCENE STATE
// -------------------------
const cutscene = {
  active: false,
  type: null,        // "townIntro", "barIntro", "bossDoor", etc.
  cameraMode: null,  // "followHero" | "target"
  camTargetX: 0,
  camTargetY: 0
};

// -------------------------
// PLAYER STATS / EQUIPMENT
// -------------------------
const playerBaseAttack = 3;

const equipment = {
  weaponId: "fists",
  armorId: "clothes"
};

// -------------------------
// QUEST & PUZZLE STATE
// -------------------------
const questState = {
  kidQuestStarted: false,
  kidQuestCompleted: false,
  visitedForest: false,

  trainingWins: 0,

  herbQuestStarted: false,
  herbQuestCompleted: false,

  builderQuestStarted: false,
  builderQuestCompleted: false,

  riverQuestStarted: false,
  riverQuestCompleted: false,
  riverBeastDefeated: false,

  shrineQuestStarted: false,
  shrineQuestCompleted: false,

  shrinePuzzleSequence: "",
  shrinePuzzleSolved: false,

  bossUnlocked: false,
  bossDefeated: false,

  townIntroDone: false,
  barIntroDone: false,
  barFightCompleted: false
};

function allMainQuestsCompleted() {
  return (
    questState.kidQuestCompleted &&
    questState.herbQuestCompleted &&
    questState.builderQuestCompleted &&
    questState.riverQuestCompleted &&
    questState.shrineQuestCompleted
  );
}

// -------------------------
// INVENTORY SYSTEM
// -------------------------


const inventory = []; // {id, quantity}

function addItem(id, qty = 1) {
  if (!itemDefs[id]) {
    console.warn("Unknown item id:", id);
    return;
  }
  let it = inventory.find((i) => i.id === id);
  if (!it) {
    it = { id, quantity: 0 };
    inventory.push(it);
  }
  it.quantity += qty;
}

function removeItem(id, qty = 1) {
  const idx = inventory.findIndex((i) => i.id === id);
  if (idx === -1) return;
  inventory[idx].quantity -= qty;
  if (inventory[idx].quantity <= 0) {
    inventory.splice(idx, 1);
  }
  if (inventoryState.index >= inventory.length) {
    inventoryState.index = Math.max(0, inventory.length - 1);
  }
}

function getItemName(id) {
  return itemDefs[id]?.name || id;
}

function getItemDescription(id) {
  return itemDefs[id]?.description || "";
}

function getItemQuantity(id) {
  const it = inventory.find((i) => i.id === id);
  return it ? it.quantity : 0;
}

function playerHasItem(id) {
  return getItemQuantity(id) > 0;
}

function getWeaponPower() {
  const def = itemDefs[equipment.weaponId];
  return def && def.type === "weapon" ? (def.power || 0) : 0;
}

function getArmorDefense() {
  const def = itemDefs[equipment.armorId];
  return def && def.type === "armor" ? (def.defense || 0) : 0;
}

function getWeaponDefenseBonus() {
  const def = itemDefs[equipment.weaponId];
  return def && typeof def.weaponDefBonus === "number"
    ? def.weaponDefBonus
    : 0;
}

function getTotalDefense() {
  return getArmorDefense() + getWeaponDefenseBonus();
}

function equipWeapon(id) {
  const def = itemDefs[id];
  if (!def || def.type !== "weapon") return;
  if (equipment.weaponId === id) {
    setMessage(`${getItemName(id)} is already equipped as your weapon.`);
  } else {
    equipment.weaponId = id;
    setMessage(`You equip ${getItemName(id)} as your weapon.`);
  }
}

function equipArmor(id) {
  const def = itemDefs[id];
  if (!def || def.type !== "armor") return;
  if (equipment.armorId === id) {
    setMessage(`${getItemName(id)} is already equipped as your armor.`);
  } else {
    equipment.armorId = id;
    setMessage(`You equip ${getItemName(id)} as your armor.`);
  }
}

const inventoryState = {
  open: false,
  index: 0
};

function handleInventoryKey(e) {
  const key = e.key;
  const upKeys = ["ArrowUp", "w", "W"];
  const downKeys = ["ArrowDown", "s", "S"];
  const confirmKeys = ["Enter", " ", "z", "Z"];

  if (key === "i" || key === "I" || key === "Escape") {
    e.preventDefault();
    inventoryState.open = false;
    return;
  }

  if (inventory.length === 0) return;

  if (upKeys.includes(key)) {
    e.preventDefault();
    inventoryState.index =
      (inventoryState.index + inventory.length - 1) % inventory.length;
  } else if (downKeys.includes(key)) {
    e.preventDefault();
    inventoryState.index =
      (inventoryState.index + 1) % inventory.length;
  } else if (confirmKeys.includes(key)) {
    e.preventDefault();
    const selected = inventory[inventoryState.index];
    if (!selected) return;
    const def = itemDefs[selected.id];
    if (!def) return;

    if (def.type === "weapon") {
      equipWeapon(selected.id);
    } else if (def.type === "armor") {
      equipArmor(selected.id);
    } else if (def.type === "consumable") {
      if (gameState === "overworld") {
        const heal = def.healAmount || 5;
        if (heart.hp >= heart.maxHp) {
          setMessage("Your HP is already full.");
        } else {
          heart.hp = Math.min(heart.maxHp, heart.hp + heal);
          setMessage(`You eat ${def.name}.\nRecovered ${heal} HP.`);
          removeItem(selected.id, 1);
        }
      } else {
        setMessage("You should use that in battle.");
      }
    } else {
      setMessage("You look at it.\nIt doesn't do anything here.");
    }
  }
}

// -------------------------
// STATS PANEL
// -------------------------
function drawStatsPanel() {
  const x = canvas.width - 170;
  const y = 16;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x - 10, y - 10, 160, 70);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 10, y - 10, 160, 70);

  const weaponName = getItemName(equipment.weaponId);
  const armorName = getItemName(equipment.armorId);
  const atk = playerBaseAttack + getWeaponPower();
  const def = getTotalDefense();

  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`Weapon: ${weaponName}`, x, y);
  ctx.fillText(`Armor : ${armorName}`, x, y + 14);
  ctx.fillText(`ATK: ${atk}`, x, y + 28);
  ctx.fillText(`DEF: ${def}`, x, y + 42);
}

// -------------------------
// UTIL: circle-rect collision
// -------------------------
function circleIntersectsRect(cx, cy, r, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

// -------------------------
// OVERWORLD: HERO & CAMERA
// -------------------------
const hero = {
  x: canvas.width / 2,
  y: canvas.height - 80,
  size: 12,
  speed: 2.5,
  scriptMove: { active: false, targetX: 0, targetY: 0, speed: 0 }
};

const camera = { x: 0, y: 0 };

// -------------------------
// ROOMS (WORLD)
// -------------------------


let currentRoomId = "field";

function getCurrentRoom() {
  return rooms[currentRoomId];
}

initTilesets();

function getNearestNpc(maxDist = 40) {
  const room = getCurrentRoom();
  if (!room || !room.npcs) return null;

  let best = null;
  let bestDist = Infinity;

  for (const npc of room.npcs) {
    if (npc.active === false) continue;
    const npcCenterX = npc.x + npc.width / 2;
    const npcCenterY = npc.y + npc.height / 2;
    const dx = hero.x - npcCenterX;
    const dy = hero.y - npcCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist < maxDist && dist < bestDist) {
      bestDist = dist;
      best = npc;
    }
  }
  return best;
}

function drawTileLayer(ctx, room) {
  const layer = room.tileLayer;
  if (!layer || !layer.tiles || !layer.tiles.length) return;

  const ts = tilesets[layer.tilesetId];
  if (!ts) return;
  const img = ts.imageObj;
  if (!img) return;

  const tw = layer.tileWidth  || ts.tileWidth;
  const th = layer.tileHeight || ts.tileHeight;
  const gridW = layer.gridWidth;
  const gridH = layer.gridHeight;
  const cols = ts.columns || Math.floor(img.width / tw);

  for (let ty = 0; ty < gridH; ty++) {
    for (let tx = 0; tx < gridW; tx++) {
      const tileIndex = layer.tiles[ty * gridW + tx];
      if (tileIndex == null || tileIndex < 0) continue;

      const sx = (tileIndex % cols) * tw;
      const sy = Math.floor(tileIndex / cols) * th;

      const worldX = tx * tw;
      const worldY = ty * th;

      const screenX = Math.floor(worldX - camera.x);
      const screenY = Math.floor(worldY - camera.y);

      ctx.drawImage(img, sx, sy, tw, th, screenX, screenY, tw, th);
    }
  }
}

function drawDecor(ctx, room) {
  if (!room.decor) return;

  room.decor.forEach(inst => {
    const def = decorDefs[inst.decorId];
    if (!def) return;
    const ts = tilesets[def.tilesetId];
    if (!ts) return;
    const img = ts.imageObj;
    if (!img) return;

    const baseTileW = ts.tileWidth;
    const baseTileH = ts.tileHeight;
    const cols = ts.columns || Math.floor(img.width / baseTileW);
    const tileIndex = def.tileIndex || 0;

    const sx = (tileIndex % cols) * baseTileW;
    const sy = Math.floor(tileIndex / cols) * baseTileH;

    const drawW = def.width  || baseTileW;
    const drawH = def.height || baseTileH;
    const offsetY = def.offsetY || 0;

    const worldX = inst.x;
    const worldY = inst.y - offsetY;

    const screenX = Math.floor(worldX - camera.x);
    const screenY = Math.floor(worldY - camera.y);

    ctx.drawImage(img, sx, sy, drawW, drawH, screenX, screenY, drawW, drawH);
  });
}


// -------------------------
// SCRIPTED MOVEMENT (CUTSCENES)
// -------------------------
function updateEntityScriptMovement(entity) {
  if (!entity || !entity.scriptMove || !entity.scriptMove.active) return;
  const move = entity.scriptMove;
  const dx = move.targetX - entity.x;
  const dy = move.targetY - entity.y;
  const dist = Math.hypot(dx, dy);
  const sp = move.speed || 2;
  if (dist <= sp) {
    entity.x = move.targetX;
    entity.y = move.targetY;
    move.active = false;
  } else {
    entity.x += (dx / dist) * sp;
    entity.y += (dy / dist) * sp;
  }
}

function updateScriptedMovement(dt) {
  const room = getCurrentRoom();
  if (!room) return;
  updateEntityScriptMovement(hero);
  if (room.npcs) {
    for (const npc of room.npcs) {
      updateEntityScriptMovement(npc);
    }
  }
}

// -------------------------
// CAMERA
// -------------------------
function updateCamera() {
  const room = getCurrentRoom();
  if (!room) return;

  const halfW = canvas.width / 2;
  const halfH = canvas.height / 2;
  const maxX = Math.max(0, room.width - canvas.width);
  const maxY = Math.max(0, room.height - canvas.height);

  let focusX, focusY;
  if (cutscene.active && cutscene.cameraMode === "target") {
    focusX = cutscene.camTargetX;
    focusY = cutscene.camTargetY;
  } else {
    focusX = hero.x;
    focusY = hero.y;
  }

  let desiredX = focusX - halfW;
  let desiredY = focusY - halfH;

  if (desiredX < 0) desiredX = 0;
  if (desiredY < 0) desiredY = 0;
  if (desiredX > maxX) desiredX = maxX;
  if (desiredY > maxY) desiredY = maxY;

  const lerpFactor = 0.15;
  camera.x += (desiredX - camera.x) * lerpFactor;
  camera.y += (desiredY - camera.y) * lerpFactor;

  camera.x = Math.floor(camera.x);
  camera.y = Math.floor(camera.y);
}

// -------------------------
// ROOM TRANSITION + DOOR COOLDOWN
// -------------------------
const transition = {
  active: false,
  phase: "none",
  alpha: 0,
  nextRoomId: null,
  nextX: 0,
  nextY: 0,
  message: ""
};

let doorCooldown = 0;

function startRoomTransition(door) {
  if (!door || transition.active) return;
  transition.active = true;
  transition.phase = "out";
  transition.alpha = 0;
  transition.nextRoomId = door.targetRoom;
  transition.nextX = door.targetX;
  transition.nextY = door.targetY;
  transition.message = door.message || "";
}

// -------------------------
// CUTSCENES
// -------------------------
function startTownIntroCutscene() {
  questState.townIntroDone = true;
  cutscene.active = true;
  cutscene.type = "townIntro";
  cutscene.cameraMode = "target";

  const townRoom = rooms.town;
  let focusX = 700;
  let focusY = 450;
  if (townRoom) {
    focusX = townRoom.width / 2;
    focusY = townRoom.height / 2;
  }
  cutscene.camTargetX = focusX;
  cutscene.camTargetY = focusY;

  setMessage(
    "You emerge into a small clifftop town.\nLanterns flicker against the stone.",
    () => {
      setMessage(
        "People steal glances at you,\nbut their eyes keep drifting to a noisy bar nearby.",
        () => {
          cutscene.active = false;
          cutscene.type = null;
          cutscene.cameraMode = null;

          const townRoom2 = rooms.town;
          if (!townRoom2 || !townRoom2.doors) {
            setMessage("You hear shouting from somewhere ahead.");
            return;
          }
          const barDoor = townRoom2.doors.find(
            (d) => d.targetRoom === "bar"
          );
          if (!barDoor) {
            setMessage("You hear shouting from a building ahead.");
            return;
          }

          hero.x = barDoor.x + barDoor.width / 2;
          hero.y = barDoor.y + barDoor.height + 20;
          updateCamera();

          setMessage(
            "The shouting peaks. Glass shatters inside the bar.",
            () => {
              startRoomTransition(barDoor);
            }
          );
        }
      );
    }
  );
}

function startBarIntroCutscene() {
  questState.barIntroDone = true;
  cutscene.active = true;
  cutscene.type = "barIntro";
  cutscene.cameraMode = "followHero";

  const barRoom = rooms.bar;
  let wizardCenterX = canvas.width / 2;
  let wizardCenterY = canvas.height / 2;

  if (barRoom) {
    const wizardA = barRoom.npcs.find((n) => n.id === "wizardA");
    const wizardB = barRoom.npcs.find((n) => n.id === "wizardB");

    if (wizardA && wizardB) {
      wizardCenterX = (wizardA.x + wizardB.x) / 2;
      wizardCenterY = (wizardA.y + wizardB.y) / 2;
    }

    hero.scriptMove = {
      active: true,
      targetX: hero.x,
      targetY: hero.y - 60,
      speed: 1.8
    };
  }

  setMessage(
    "The bar is chaos.\nBolts of light crackle between two wizards.",
    () => {
      cutscene.cameraMode = "target";
      cutscene.camTargetX = wizardCenterX;
      cutscene.camTargetY = wizardCenterY;

      setMessage(
        'Wizard 1: "You snapped my wand in half!"',
        () => {
          setMessage(
            'Wizard 2: "No, YOU stepped on MINE!"',
            () => {
              cutscene.cameraMode = "followHero";

              const barRoom2 = rooms.bar;
              if (barRoom2) {
                const bartender = barRoom2.npcs.find(
                  (n) => n.id === "bartender"
                );
                if (bartender) {
                  bartender.scriptMove = {
                    active: true,
                    targetX: hero.x - 20,
                    targetY: hero.y - 20,
                    speed: 1.6
                  };
                }
              }

              setMessage(
                'The bartender hustles over to you.\n"Hey, you look strong. Think you can sort this out?\nI\'ll cover ale and food if you do."',
                () => {
                  const barRoom3 = rooms.bar;
                  let targetX = hero.x;
                  let targetY = hero.y;
                  if (barRoom3) {
                    const wizardA2 = barRoom3.npcs.find(
                      (n) => n.id === "wizardA"
                    );
                    const wizardB2 = barRoom3.npcs.find(
                      (n) => n.id === "wizardB"
                    );
                    if (wizardA2 && wizardB2) {
                      targetX = (wizardA2.x + wizardB2.x) / 2;
                      targetY = wizardA2.y + 60;
                    }
                  }

                  hero.scriptMove = {
                    active: true,
                    targetX,
                    targetY,
                    speed: 1.8
                  };
                  cutscene.cameraMode = "followHero";

                  setMessage(
                    "You step toward the dueling wizards.\nA table leg cracks loudly under your boot.",
                    () => {
                      setMessage(
                        'Wizard 1: "HEY! That was my wand!"\nWizard 2: "You just crushed mine too!"',
                        () => {
                          cutscene.active = false;
                          cutscene.type = null;
                          cutscene.cameraMode = null;
                          enterBattle(null, "wizard_duo");
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

function startBossDoorCutscene() {
  const trialRoom = rooms.trial;
  if (!trialRoom || !trialRoom.doors) {
    setMessage(
      "Somewhere in the hall, stone grinds open."
    );
    return;
  }

  const door = trialRoom.doors.find((d) => d.targetRoom === "town");
  let cx = 600;
  let cy = 740;
  if (door) {
    cx = door.x + door.width / 2;
    cy = door.y + door.height / 2;
  }

  cutscene.active = true;
  cutscene.type = "bossDoor";
  cutscene.cameraMode = "target";
  cutscene.camTargetX = cx;
  cutscene.camTargetY = cy;

  setMessage(
    "At the far end of the hall, a sealed stone door rumbles open.\nA path toward the town above reveals itself.",
    () => {
      cutscene.active = false;
      cutscene.type = null;
      cutscene.cameraMode = null;
    }
  );
}

// -------------------------
// UPDATE TRANSITION
// -------------------------
function updateTransition(dt) {
  if (!transition.active) return;
  const speed = 0.0025;

  if (transition.phase === "out") {
    transition.alpha += speed * dt;
    if (transition.alpha >= 1) {
      transition.alpha = 1;
      if (transition.nextRoomId && rooms[transition.nextRoomId]) {
        currentRoomId = transition.nextRoomId;
        hero.x = transition.nextX;
        hero.y = transition.nextY;

        if (transition.nextRoomId === "forest") {
          questState.visitedForest = true;
        }

        const targetId = transition.nextRoomId;
        if (targetId === "town" && !questState.townIntroDone) {
          setMessage(
            transition.message ||
              "You step out into a small town above the trials.",
            () => {
              startTownIntroCutscene();
            }
          );
        } else if (targetId === "bar" && !questState.barIntroDone) {
          setMessage(
            transition.message || "You step into the Lantern Bar.",
            () => {
              startBarIntroCutscene();
            }
          );
        } else if (transition.message) {
          setMessage(transition.message);
        }
      }
      doorCooldown = 400;
      transition.phase = "in";
    }
  } else if (transition.phase === "in") {
    transition.alpha -= speed * dt;
    if (transition.alpha <= 0) {
      transition.alpha = 0;
      transition.active = false;
      transition.phase = "none";
    }
  }
}

// -------------------------
// QUEST OBJECT & PUZZLE STATE
// -------------------------
function updateQuestObjects() {
  const fieldRoom = rooms.field;
  if (fieldRoom && fieldRoom.npcs) {
    const charmNpc = fieldRoom.npcs.find((n) => n.id === "lost_charm");
    if (charmNpc) {
      charmNpc.active =
        questState.kidQuestStarted &&
        questState.visitedForest &&
        !questState.kidQuestCompleted &&
        !playerHasItem("lucky_charm");
    }
  }

  const bridgeRoom = rooms.bridge;
  if (bridgeRoom && bridgeRoom.npcs) {
    const herbNpc = bridgeRoom.npcs.find((n) => n.id === "river_herb");
    if (herbNpc) {
      herbNpc.active =
        questState.herbQuestStarted &&
        !questState.herbQuestCompleted &&
        !playerHasItem("river_herb");
    }
  }

  const cliffsRoom = rooms.cliffs;
  if (cliffsRoom && cliffsRoom.npcs) {
    const stoneNpc = cliffsRoom.npcs.find((n) => n.id === "stone_chunk");
    if (stoneNpc) {
      stoneNpc.active =
        questState.builderQuestStarted &&
        !questState.builderQuestCompleted &&
        !playerHasItem("stone_chunk");
    }
  }

  const shrineRoom = rooms.shrine;
  if (shrineRoom && shrineRoom.npcs) {
    const chest = shrineRoom.npcs.find((n) => n.id === "shrine_chest");
    if (chest) {
      chest.active = questState.shrinePuzzleSolved;
    }
  }
}

// -------------------------
// SHRINE PUZZLE HANDLER
// -------------------------
function handleShrineStone(npc) {
  if (questState.shrinePuzzleSolved) {
    setMessage("The stone is quiet now.\nWhatever it was guarding is already open.");
    return;
  }

  let symbol = "A";
  if (npc.id === "stoneB") symbol = "B";
  if (npc.id === "stoneC") symbol = "C";

  let seq = questState.shrinePuzzleSequence || "";

  if (seq.length >= 3) {
    seq = "";
  }
  seq += symbol;

  if (seq.length === 3) {
    if (seq === "ACB") {
      questState.shrinePuzzleSolved = true;
      questState.shrinePuzzleSequence = "";
      const shrineRoom = rooms.shrine;
      if (shrineRoom && shrineRoom.npcs) {
        const chest = shrineRoom.npcs.find((n) => n.id === "shrine_chest");
        if (chest) chest.active = true;
      }
      setMessage(
        "As you touch the last stone,\nthe shrine rumbles.\nA hidden chest appears near the altar."
      );
    } else {
      seq = "";
      questState.shrinePuzzleSequence = seq;
      setMessage("The stones fall silent.\nThat pattern felt wrong.");
    }
  } else {
    questState.shrinePuzzleSequence = seq;
    setMessage("The stone hums softly.");
  }
}

// -------------------------
// STATUE (BOSS UNLOCK) HANDLER
// -------------------------
function handleStatueInteraction() {
  if (!allMainQuestsCompleted()) {
    setMessage(
      'The statue\'s eyes are closed.\nYou feel it asking for water, stone,\nriver, and shrine to be settled first.'
    );
    return;
  }

  const hasBlade = playerHasItem("river_blade");
  const hasMoon = playerHasItem("moon_charm");

  if (!questState.bossUnlocked) {
    if (!hasBlade || !hasMoon) {
      setMessage(
        "The statue's hands are empty.\nYou sense it wants a blade and a moon-lit stone."
      );
      return;
    }

    removeItem("river_blade", 1);
    removeItem("moon_charm", 1);

    const resetWeapon = equipment.weaponId === "river_blade";
    const resetArmor = equipment.armorId === "moon_charm";

    if (resetWeapon) equipment.weaponId = "fists";
    if (resetArmor) equipment.armorId = "clothes";

    questState.bossUnlocked = true;

    let text =
      "You place the River Blade and Moon Stone into the statue's hands.\n" +
      "They dissolve into light.\n" +
      "Somewhere below, stone grinds open.";

    if (resetWeapon || resetArmor) {
      text +=
        "\nAs their power leaves you, your basic gear settles back into place.\n" +
        "(You should check your equipment and re-equip.)";
    }

    setMessage(
      text,
      () => {
        setMessage("A passage beneath the shrine is now open.");
      }
    );
  } else if (!questState.bossDefeated) {
    setMessage(
      'The statue\'s eyes glow faintly.\nThe path to judgment is open below.'
    );
  } else {
    setMessage(
      'The statue is still.\nIt has nothing left to ask of you.'
    );
  }
}

// -------------------------
// NPC INTERACTION
// -------------------------
function tryTalkToNpc() {
  const npc = getNearestNpc(40);
  if (!npc) {
    setMessage("Nobody is close enough to talk.");
    return;
  }

  if (npc.id === "stoneA" || npc.id === "stoneB" || npc.id === "stoneC") {
    handleShrineStone(npc);
    return;
  }

  if (npc.id === "statue") {
    handleStatueInteraction();
    return;
  }

  if (npc.id === "dummy") {
    if (npc.hasBattle) {
      setMessage(
        'Dummy: "You want to fight? Let\'s go!"',
        () => enterBattle(npc, "dummy")
      );
    } else {
      setMessage(
        npc.dialogAfterBattle || 'Dummy: "We already did this..."'
      );
    }
    return;
  }

  if (npc.id === "training_dummy") {
    const wins = questState.trainingWins;
    let text;
    if (wins === 0) {
      text =
        'Training Dummy: "Want to practice?\nHit me as much as you like."';
    } else if (wins < 3) {
      text = 'Training Dummy: "Back for more practice?"';
    } else if (wins < 7) {
      text =
        'Training Dummy: "Again? You\'re really into this, huh."\nYou can almost see it roll its eyes.';
    } else {
      text =
        'Training Dummy: "Seriously?\nFine. ONE more... probably."';
    }
    setMessage(text, () => enterBattle(npc, "training_dummy"));
    return;
  }

  if (npc.givesItemId) {
    if (!npc.opened) {
      npc.opened = true;
      const qty = npc.givesItemQty || 1;
      addItem(npc.givesItemId, qty);
      const def = itemDefs[npc.givesItemId];
      const name = def?.name || "something";
      setMessage(`You open the chest.\nYou got ${name}!`);
    } else {
      setMessage("The chest is empty.");
    }
    return;
  }

  if (npc.id === "lost_charm") {
    addItem("lucky_charm", 1);
    setMessage(
      "You pick up a small lucky charm.\nIt still feels warm from the kid's hand."
    );
    npc.active = false;
    return;
  }

  if (npc.id === "kid") {
    if (!questState.kidQuestStarted) {
      questState.kidQuestStarted = true;
      setMessage(
        'Kid: "Hey, um... I lost my lucky charm back on the Grassy Path.\nIf you see it, can you bring it back?"'
      );
    } else if (
      questState.kidQuestStarted &&
      !questState.kidQuestCompleted &&
      !playerHasItem("lucky_charm")
    ) {
      setMessage(
        'Kid: "I swear I dropped it near a weird rock back on the path...\nPlease keep an eye out!"'
      );
    } else if (
      questState.kidQuestStarted &&
      !questState.kidQuestCompleted &&
      playerHasItem("lucky_charm")
    ) {
      questState.kidQuestCompleted = true;
      removeItem("lucky_charm", 1);
      addItem("stick", 1);
      addItem("kid_scarf", 1);
      setMessage(
        'Kid: "You found it! Thank you!!\nHere, take this stick... and my scarf.\nThey might help if you get into trouble."'
      );
    } else if (questState.kidQuestCompleted) {
      setMessage(
        'Kid: "Every time I hold my charm now,\nI remember you walking out of the trees."'
      );
    }
    return;
  }

  if (npc.id === "herbalist") {
    if (!questState.herbQuestStarted) {
      questState.herbQuestStarted = true;
      setMessage(
        'Herbalist: "There\'s a rare herb on the Old Bridge.\nIf you bring me one, I\'ll make something for you."'
      );
    } else if (
      questState.herbQuestStarted &&
      !questState.herbQuestCompleted &&
      !playerHasItem("river_herb")
    ) {
      setMessage(
        'Herbalist: "The herb grows near the middle of the bridge.\nThe river sings louder where it grows."'
      );
    } else if (
      questState.herbQuestStarted &&
      !questState.herbQuestCompleted &&
      playerHasItem("river_herb")
    ) {
      questState.herbQuestCompleted = true;
      removeItem("river_herb", 1);
      addItem("snack", 1);
      setMessage(
        'Herbalist: "Perfect. The river used to carry these downstream.\nHere, take this snack as a thank you."'
      );
    } else if (questState.herbQuestCompleted) {
      setMessage(
        'Herbalist: "The water smells calmer now.\nIt remembers kindness more than it remembers storms."'
      );
    }
    return;
  }

  if (npc.id === "river_guard") {
    if (!questState.riverQuestStarted) {
      questState.riverQuestStarted = true;
      setMessage(
        'Guard: "Something in the water is angry.\nHelp me drive it off, will you?"',
        () => enterBattle(npc, "river_beast")
      );
    } else if (
      questState.riverQuestStarted &&
      !questState.riverQuestCompleted
    ) {
      if (!questState.riverBeastDefeated) {
        setMessage(
          'Guard: "That thing is still out there.\nStay sharp when you face it."',
          () => enterBattle(npc, "river_beast")
        );
      } else {
        questState.riverQuestCompleted = true;
        setMessage(
          'Guard: "The river is calmer now.\nThat blade suits you.\nTry not to anger anything else, yeah?"'
        );
      }
    } else if (questState.riverQuestCompleted) {
      setMessage('Guard: "Enjoy the quiet water while it lasts."');
    }
    return;
  }

  if (npc.id === "river_herb") {
    addItem("river_herb", 1);
    setMessage(
      "You carefully pick the fragrant river herb.\nIt glows faintly with river mist."
    );
    npc.active = false;
    return;
  }

  if (npc.id === "stone_chunk") {
    addItem("stone_chunk", 1);
    setMessage(
      "You pry a heavy chunk of stone from the cliff.\nThe wind howls for a moment, then quiets."
    );
    npc.active = false;
    return;
  }

  if (npc.id === "builder") {
    if (!questState.builderQuestStarted) {
      questState.builderQuestStarted = true;
      setMessage(
        'Builder: "This bridge creaks like an old man.\nBring me a sturdy stone from the cliffs and I\'ll fix it up."'
      );
    } else if (
      questState.builderQuestStarted &&
      !questState.builderQuestCompleted &&
      !playerHasItem("stone_chunk")
    ) {
      setMessage(
        'Builder: "Any solid chunk from the cliff edge should work.\nCareful not to follow it down."'
      );
    } else if (
      questState.builderQuestStarted &&
      !questState.builderQuestCompleted &&
      playerHasItem("stone_chunk")
    ) {
      questState.builderQuestCompleted = true;
      removeItem("stone_chunk", 1);
      addItem("bridge_mail", 1);
      setMessage(
        'Builder: "Nice. This will keep the bridge steady.\nHere, take this light armor.\nNo point fixing paths if no one survives to walk them."'
      );
    } else if (questState.builderQuestCompleted) {
      setMessage(
        'Builder: "Feels safer, doesn\'t it?\nStones remember where they fall."'
      );
    }
    return;
  }

  if (npc.id === "ghost") {
    if (!questState.shrineQuestStarted) {
      if (
        !questState.herbQuestCompleted ||
        !questState.builderQuestCompleted
      ) {
        setMessage(
          'Spirit: "The river still trembles, and the bridge still groans.\nHelp those below, then return to me."'
        );
      } else {
        questState.shrineQuestStarted = true;
        setMessage(
          'Spirit: "You mended water and stone.\nNow face me, and I shall finally rest."',
          () => enterBattle(npc, "shrine_spirit")
        );
      }
    } else if (
      questState.shrineQuestStarted &&
      !questState.shrineQuestCompleted
    ) {
      setMessage(
        'Spirit: "If you still hear my echo,\nthen our battle is not finished."',
        () => enterBattle(npc, "shrine_spirit")
      );
    } else if (questState.shrineQuestCompleted) {
      setMessage(
        'Spirit: "Thank you. The shrine is quiet now.\nThe world above is yours to walk."'
      );
    }
    return;
  }

  if (npc.id === "boss") {
    if (!questState.bossUnlocked) {
      setMessage(
        "You feel a wall in the air.\nSomething back in the shrine hasn't been offered yet."
      );
    } else if (questState.bossDefeated) {
      setMessage(
        'Judge: "Your step no longer shakes.\nYou have no more to prove here."'
      );
    } else {
      setMessage(
        'Judge: "You walk by choice into this hall.\nProve that choice wasn\'t a mistake."',
        () => enterBattle(npc, "trial_boss")
      );
    }
    return;
  }

  if (npc.id === "bartender") {
    if (!questState.barIntroDone) {
      startBarIntroCutscene();
    } else if (!questState.barFightCompleted) {
      setMessage(
        'Bartender: "If you can get those two to stop yelling,\nI\'ll keep the food coming."'
      );
    } else {
      setMessage(
        'Bartender: "Never seen two wizards shut up that fast.\nYour ale is always welcome here."'
      );
    }
    return;
  }

  if (npc.id === "wizardA" || npc.id === "wizardB") {
    if (!questState.barIntroDone) {
      setMessage("They barely notice you, too busy shouting at each other.");
    } else if (!questState.barFightCompleted) {
      setMessage("Arcane sparks snap between them.\nThey don't look ready to talk.");
    } else {
      setMessage(
        'Wizard: "Okay, okay... maybe it wasn\'t your fault after all."'
      );
    }
    return;
  }

  if (npc.dialog) {
    setMessage(npc.dialog);
  } else {
    setMessage(`${npc.label || "Someone"} has nothing to say.`);
  }
}

// -------------------------
// OVERWORLD UPDATE & DRAW
// -------------------------
function updateOverworld(dt) {
  const room = getCurrentRoom();
  if (!room) return;

  let vx = 0;
  let vy = 0;

  if (!cutscene.active && !inventoryState.open) {
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) vx -= 1;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) vx += 1;
    if (keys["ArrowUp"] || keys["w"] || keys["W"]) vy -= 1;
    if (keys["ArrowDown"] || keys["s"] || keys["S"]) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const inv = Math.sqrt(2);
      vx /= inv;
      vy /= inv;
    }
  }

  const oldX = hero.x;
  const oldY = hero.y;

  if (vx !== 0 || vy !== 0) {
    hero.x += vx * hero.speed;
    hero.y += vy * hero.speed;

    const margin = hero.size;
    if (hero.x < margin) hero.x = margin;
    if (hero.y < margin) hero.y = margin;
    if (hero.x > room.width - margin) hero.x = room.width - margin;
    if (hero.y > room.height - margin) hero.y = room.height - margin;

    if (room.walls) {
      for (const w of room.walls) {
        if (circleIntersectsRect(hero.x, hero.y, hero.size, w)) {
          hero.x = oldX;
          hero.y = oldY;
          break;
        }
      }
    }
  }

  if (cutscene.active) {
    updateScriptedMovement(dt);
  }

  if (!cutscene.active && room.doors && doorCooldown <= 0) {
    for (const door of room.doors) {
      if (
        hero.x >= door.x &&
        hero.x <= door.x + door.width &&
        hero.y >= door.y &&
        hero.y <= door.y + door.height
      ) {
        if (door.requiresBossUnlock && !questState.bossUnlocked) {
          setMessage(
            "A sealed passage hums under your feet.\nSomething in the shrine might open it."
          );
          doorCooldown = 400;
        } else if (door.requiresBossDefeated && !questState.bossDefeated) {
          setMessage(
            "A heavy stone door stays shut.\nYou sense a trial unfinished."
          );
          doorCooldown = 400;
        } else {
          startRoomTransition(door);
        }
        break;
      }
    }
  }
}

function drawInventoryOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("INVENTORY (I to close)", 60, 52);

  ctx.font = "14px sans-serif";
  ctx.fillText(
    `Weapon: ${getItemName(equipment.weaponId)}`,
    60,
    80
  );
  ctx.fillText(
    `Armor : ${getItemName(equipment.armorId)}`,
    60,
    100
  );

  const listStartY = 130;

  if (inventory.length === 0) {
    ctx.fillText("Empty.", 60, listStartY);
    return;
  }

  const lineHeight = 20;
  inventory.forEach((item, idx) => {
    const y = listStartY + idx * lineHeight;
    if (idx === inventoryState.index) {
      ctx.fillStyle = "#ffffff";
      ctx.fillText(">", 60, y);
    }
    ctx.fillStyle = "#ffffff";
    const name = getItemName(item.id);
    ctx.fillText(`${name} x${item.quantity}`, 80, y);
  });

  const selected = inventory[inventoryState.index];
  if (selected) {
    const desc = getItemDescription(selected.id);
    const boxY = canvas.height - 100;
    ctx.fillStyle = "#000000";
    ctx.fillRect(60, boxY, canvas.width - 120, 60);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(60, boxY, canvas.width - 120, 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    wrapText(desc, 70, boxY + 8, canvas.width - 140, 16);
  }
}

function drawOverworld() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const room = getCurrentRoom();

  const gridSize = 40;
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;

  const offsetX = -(camera.x % gridSize);
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  const offsetY = -(camera.y % gridSize);
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (room) {
    if (room.name) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(room.name, 16, 16);
    }

    if (room.walls) {
      ctx.fillStyle = "#111111";
      for (const w of room.walls) {
        ctx.fillRect(
          w.x - camera.x,
          w.y - camera.y,
          w.width,
          w.height
        );
      }
    }

    if (room.doors) {
      ctx.fillStyle = "#222222";
      for (const d of room.doors) {
        ctx.fillRect(
          d.x - camera.x,
          d.y - camera.y,
          d.width,
          d.height
        );
      }
    }

    if (room.npcs) {
      for (const npc of room.npcs) {
        if (npc.active === false) continue;
        if (
          npc.id === "lost_charm" ||
          npc.id === "river_herb" ||
          npc.id === "stone_chunk"
        ) {
          ctx.fillStyle = "#00ffff";
        } else {
          ctx.fillStyle = "#ffff00";
        }
        ctx.fillRect(
          npc.x - camera.x,
          npc.y - camera.y,
          npc.width,
          npc.height
        );
        if (npc.label) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "12px sans-serif";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            npc.label,
            npc.x - camera.x - 4,
            npc.y - camera.y - 4
          );
        }
      }
    }
  }

  drawHeartSprite(
    hero.x - camera.x,
    hero.y - camera.y,
    hero.size
  );

  const nearNpc = getNearestNpc(50);
  if (nearNpc && !cutscene.active) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(
      "Press Z / Enter to interact",
      nearNpc.x - camera.x - 60,
      nearNpc.y - camera.y + nearNpc.height + 10
    );
  }

  if (transition.active) {
    const a = Math.max(0, Math.min(1, transition.alpha));
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (inventoryState.open) {
    drawInventoryOverlay();
  }

  drawStatsPanel();
  function drawOverworld(ctx) {
  const room = rooms[currentRoomId];

  // 1) Background tiles
  drawTileLayer(ctx, room);

  // 2) Walls / collision geometry (same as you had)
  drawWalls(ctx, room);   // whatever your wall-drawing function is called

  // 3) Decorative props
  drawDecor(ctx, room);

  // 4) NPCs, player, UI, etc. (your existing stuff)
  drawNPCs(ctx, room);
  drawPlayer(ctx);
  drawOverworldUI(ctx);
}

}
