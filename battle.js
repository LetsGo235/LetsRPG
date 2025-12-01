// battle.js

// battle.js

const enemyTypes = window.gameData.enemies;

// (rest of battle.js stays exactly as it is)

// -------------------------
// BATTLE STATE & ENEMIES
// -------------------------
const battleBox = {
  x: 150,
  y: 180,
  width: 300,
  height: 150
};

const heart = {
  x: battleBox.x + battleBox.width / 2,
  y: battleBox.y + battleBox.height / 2,
  size: 8,
  speed: 3,
  hp: 20,
  maxHp: 20,
  alive: true
};

const enemy = {
  name: "Dummy",
  hp: 30,
  maxHp: 30,
  attacking: false
};

let currentEnemyTypeId = "dummy";

let bullets = [];
let lastSpawn = 0;
let attackQTE = null;
let currentBattleNpc = null;

const battleItemSelect = {
  open: false,
  index: 0,
  items: []
};

function resetBattleData() {
  const type = enemyTypes[currentEnemyTypeId] || enemyTypes["dummy"];

  enemy.name = type.name;
  enemy.maxHp = type.maxHp;
  enemy.hp = type.maxHp;
  enemy.attacking = false;

  heart.x = battleBox.x + battleBox.width / 2;
  heart.y = battleBox.y + battleBox.height / 2;
  heart.hp = heart.maxHp;
  heart.alive = true;

  bullets = [];
  lastSpawn = 0;
  attackQTE = null;
  battleItemSelect.open = false;
  battleItemSelect.index = 0;
  battleItemSelect.items = [];

  if (battleState) {
    if (type.isDuo) {
      const hps = type.duoMaxHp || [type.maxHp, type.maxHp];
      const total = (hps[0] || 0) + (hps[1] || 0);
      enemy.maxHp = total;
      enemy.hp = total;
      battleState.duo = {
        names: type.duoNames || ["Wizard A", "Wizard B"],
        maxHp: [hps[0] || 0, hps[1] || 0],
        hp: [hps[0] || 0, hps[1] || 0],
        targetIndex: 0,
        lastSpawnA: 0,
        lastSpawnB: 0
      };
    } else {
      battleState.duo = null;
    }
  }
}

function enterBattle(npc, enemyId) {
  currentBattleNpc = npc || null;
  currentEnemyTypeId =
    enemyId || (npc && npc.battleEnemyId) || "dummy";

  gameState = "battle";
  battleState = {
    phase: "intro",
    phaseTime: 0,
    turnIndex: 0,
    duo: null
  };

  resetBattleData();

  const type = enemyTypes[currentEnemyTypeId] || enemyTypes["dummy"];

  menuEl.style.display = "none";
  playBgm(currentEnemyTypeId === "trial_boss" ? "boss" : "battle");
  setMessage(
    `${type.name} appears!\nPress Z / Enter to continue.`,
    () => {
      startPlayerTurn();
    }
  );
}

function exitBattle(victory, options) {
  options = options || {};
  const skipMessage = !!options.skipMessage;

  gameState = "overworld";
  bullets = [];
  enemy.attacking = false;
  battleState = null;
  menuEl.style.display = "none";
  playBgm("overworld");

  if (victory && currentBattleNpc && currentBattleNpc.hasBattle) {
    currentBattleNpc.hasBattle = false;
  }
  currentBattleNpc = null;

  if (!skipMessage) {
    const room = getCurrentRoom();
    const placeName = room && room.name ? room.name : "the area";
    if (victory) {
      setMessage(
        `You won the battle\nand find yourself back in ${placeName}.`
      );
    } else {
      setMessage(
        `You catch your breath\nback in ${placeName}.`
      );
    }
  }
}

function startPlayerTurn() {
  if (!battleState) return;
  battleState.phase = "playerTurn";
  battleState.phaseTime = 0;
  enemy.attacking = false;
  bullets = [];
  attackQTE = null;
  battleItemSelect.open = false;
  battleItemSelect.items = [];
  heart.x = battleBox.x + battleBox.width / 2;
  heart.y = battleBox.y + battleBox.height / 2;
  menuEl.style.display = "flex";
  menuIndex = 0;
  updateMenuHighlight();
  setMessage("What will you do?");
}

// -------------------------
// ATTACK QTE
// -------------------------
function startAttackQTE() {
  if (!battleState) return;
  battleState.phase = "attackQTE";
  battleState.phaseTime = 0;
  attackQTE = { pos: 0, dir: 1 };
  menuEl.style.display = "none";
  setMessage("Press Z / Enter when\nthe marker is in the center!");
}

function updateAttackQTE(dt) {
  if (!attackQTE) return;
  const speed = 0.0025;
  attackQTE.pos += attackQTE.dir * speed * dt;

  if (attackQTE.pos <= 0) {
    attackQTE.pos = 0;
    attackQTE.dir = 1;
  } else if (attackQTE.pos >= 1) {
    attackQTE.pos = 1;
    attackQTE.dir = -1;
  }
}

function handleQteConfirm() {
  if (!attackQTE || !battleState || battleState.phase !== "attackQTE") {
    return;
  }

  const center = 0.5;
  const distance = Math.abs(attackQTE.pos - center);
  const multiplier = Math.max(0, 1 - distance * 2);

  const weaponPower = getWeaponPower();
  const attackPower = playerBaseAttack + weaponPower;
  const bonus = Math.round(attackPower * multiplier);
  const dmg = Math.max(1, attackPower + bonus);

  const weaponName = getItemName(equipment.weaponId);
  playSfx(sfxHit);

  let msg;

  if (battleState.duo) {
    const d = battleState.duo;
    let ti = d.targetIndex;

    if (d.hp[ti] <= 0) {
      ti = d.hp[0] > 0 ? 0 : 1;
      d.targetIndex = ti;
    }

    const targetName = d.names[ti];
    d.hp[ti] -= dmg;
    if (d.hp[ti] < 0) d.hp[ti] = 0;
    enemy.hp = d.hp[0] + d.hp[1];

    msg =
      `You strike ${targetName} with your ${weaponName}!\n` +
      `You deal ${dmg} damage!`;
  } else {
    enemy.hp -= dmg;
    if (enemy.hp < 0) enemy.hp = 0;
    msg =
      `You strike with your ${weaponName}!\n` +
      `You deal ${dmg} damage!`;
  }

  attackQTE = null;

  if (enemy.hp <= 0) {
    setMessage(msg, () => {
      onEnemyDefeated();
    });
  } else {
    setMessage(msg, () => {
      startEnemyDialogue();
    });
  }
}

// -------------------------
// ENEMY DIALOGUE & ATTACK
// -------------------------
function startEnemyDialogue() {
  if (!battleState) return;
  battleState.phase = "enemyDialogue";
  battleState.phaseTime = 0;
  menuEl.style.display = "none";

  const type = enemyTypes[currentEnemyTypeId] || enemyTypes["dummy"];
  const lines = type.lines && type.lines.length ? type.lines : [
    `${type.name} glares silently.`
  ];
  const line =
    lines[battleState.turnIndex % lines.length];

  setMessage(line, () => {
    startEnemyAttack();
  });
}

function startEnemyAttack() {
  if (!battleState) return;
  battleState.phase = "enemyAttack";
  battleState.phaseTime = 0;
  enemy.attacking = true;
  bullets = [];
  lastSpawn = 0;

  if (battleState.duo && currentEnemyTypeId === "wizard_duo") {
    battleState.duo.lastSpawnA = 0;
    battleState.duo.lastSpawnB = 0;
  }

  setMessage("The foe attacks!");
}

function endEnemyAttack() {
  if (!battleState) return;
  enemy.attacking = false;
  bullets = [];
  battleState.turnIndex++;
  startPlayerTurn();
}

function onEnemyDefeated() {
  if (!battleState) return;
  battleState.phase = "end";
  enemy.attacking = false;
  bullets = [];
  menuEl.style.display = "none";

  const typeId = currentEnemyTypeId;
  let extra = "";

  if (typeId === "training_dummy") {
    questState.trainingWins++;
    if (questState.trainingWins === 1) {
      addItem("dummy_bandage", 1);
      extra += "\nThe Training Dummy hands you a bandage.";
    } else if (questState.trainingWins === 3) {
      addItem("dummy_gloves", 1);
      extra += "\nThe Training Dummy gives you some heavy gloves.";
    }
  }

  if (typeId === "river_beast" && !questState.riverBeastDefeated) {
    questState.riverBeastDefeated = true;
    addItem("river_blade", 1);
    extra += "\nSomething shiny floats to shore.\nIt's a river blade.";
  }

  if (typeId === "shrine_spirit" && !questState.shrineQuestCompleted) {
    questState.shrineQuestCompleted = true;
    addItem("ghost_cloak", 1);
    extra += "\nThe spirit leaves behind a faded cloak.";
  }

  if (typeId === "wizard_duo" && !questState.barFightCompleted) {
    questState.barFightCompleted = true;
    addItem("bar_ale", 2);
    addItem("bar_meal", 2);
    extra += "\nThe bartender cheers and hands you ale and a hot meal.";
  }

  if (typeId === "trial_boss" && !questState.bossDefeated) {
    questState.bossDefeated = true;
    addItem("moon_blade", 1);
    equipWeapon("moon_blade");
    extra +=
      "\nYour River Blade and Moon Stone drift back from the void\nas a single Moonlit Blade.";

    const victoryText =
      "The Judge dissolves into dust.\nYou stand alone in the silent hall." +
      (extra ? "\n" + extra : "");

    setMessage(
      victoryText,
      () => {
        exitBattle(true, { skipMessage: true });
        startBossDoorCutscene();
      }
    );
    return;
  }

  setMessage(
    "The foe is defeated.\nYou win!" + (extra ? "\n" + extra : ""),
    () => {
      exitBattle(true);
    }
  );
}

// -------------------------
// BATTLE UPDATE HELPERS
// -------------------------
function updateHeart() {
  if (!heart.alive) return;

  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) heart.x -= heart.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) heart.x += heart.speed;
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) heart.y -= heart.speed;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) heart.y += heart.speed;

  const minX = battleBox.x + heart.size;
  const maxX = battleBox.x + battleBox.width - heart.size;
  const minY = battleBox.y + heart.size;
  const maxY = battleBox.y + battleBox.height - heart.size;

  if (heart.x < minX) heart.x = minX;
  if (heart.x > maxX) heart.x = maxX;
  if (heart.y < minY) heart.y = minY;
  if (heart.y > maxY) heart.y = maxY;
}

function spawnDownBullet(speedMul = 1) {
  const radius = 6;
  const x =
    battleBox.x + radius + Math.random() * (battleBox.width - radius * 2);
  const y = battleBox.y - 10;
  bullets.push({
    x,
    y,
    vx: 0,
    vy: (2 + Math.random() * 1.5) * speedMul,
    radius,
    alive: true
  });
}

function spawnSideBullets(speedMul = 1) {
  const radius = 6;
  const y =
    battleBox.y + radius + Math.random() * (battleBox.height - radius * 2);
  bullets.push({
    x: battleBox.x - 10,
    y,
    vx: 3 * speedMul,
    vy: 0,
    radius,
    alive: true
  });
  bullets.push({
    x: battleBox.x + battleBox.width + 10,
    y,
    vx: -3 * speedMul,
    vy: 0,
    radius,
    alive: true
  });
}

function spawnDiagonalBullets(speedMul = 1) {
  const radius = 6;
  bullets.push({
    x: battleBox.x + radius,
    y: battleBox.y - 10,
    vx: 2 * speedMul,
    vy: 2 * speedMul,
    radius,
    alive: true
  });
  bullets.push({
    x: battleBox.x + battleBox.width - radius,
    y: battleBox.y - 10,
    vx: -2 * speedMul,
    vy: 2 * speedMul,
    radius,
    alive: true
  });
}

function spawnCrossBullets() {
  const cx = battleBox.x + battleBox.width / 2;
  const cy = battleBox.y + battleBox.height / 2;
  const radius = 5;
  const speed = 3.2;

  bullets.push({ x: cx, y: cy, vx: speed, vy: 0, radius, alive: true });
  bullets.push({ x: cx, y: cy, vx: -speed, vy: 0, radius, alive: true });
  bullets.push({ x: cx, y: cy, vx: 0, vy: speed, radius, alive: true });
  bullets.push({ x: cx, y: cy, vx: 0, vy: -speed, radius, alive: true });
}

function spawnTargetedBullet() {
  const radius = 5;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) {
    x = battleBox.x + Math.random() * battleBox.width;
    y = battleBox.y - 10;
  } else if (side === 1) {
    x = battleBox.x + battleBox.width + 10;
    y = battleBox.y + Math.random() * battleBox.height;
  } else if (side === 2) {
    x = battleBox.x + Math.random() * battleBox.width;
    y = battleBox.y + battleBox.height + 10;
  } else {
    x = battleBox.x - 10;
    y = battleBox.y + Math.random() * battleBox.height;
  }

  const dx = heart.x - x;
  const dy = heart.y - y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 3.5;
  bullets.push({
    x,
    y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    radius,
    alive: true
  });
}

function updateBulletsAndCollisions() {
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += b.vx;
    b.y += b.vy;

    if (
      b.x < battleBox.x - 40 ||
      b.x > battleBox.x + battleBox.width + 40 ||
      b.y < battleBox.y - 40 ||
      b.y > battleBox.y + battleBox.height + 40
    ) {
      b.alive = false;
      continue;
    }

    if (heart.alive) {
      const dx = b.x - heart.x;
      const dy = b.y - heart.y;
      const dist = Math.hypot(dx, dy);
      if (dist < b.radius + heart.size) {
        const defense = getTotalDefense();
        if (defense > 0) {
          const avoidChance = Math.min(0.7, defense * 0.15);
          if (Math.random() < avoidChance) {
            b.alive = false;
            continue;
          }
        }

        b.alive = false;
        heart.hp -= 1;
        playSfx(sfxHurt);
        if (heart.hp <= 0) {
          heart.hp = 0;
          heart.alive = false;
          enemy.attacking = false;
          if (battleState) battleState.phase = "end";
          menuEl.style.display = "none";
          setMessage(
            "You fall...\nYou wake up back where you started.",
            () => {
              exitBattle(false, { skipMessage: true });
            }
          );
        }
      }
    }
  }

  bullets = bullets.filter((b) => b.alive);
}

function updateWizardDuoAttack(dt) {
  if (!battleState || !battleState.duo) return;
  const d = battleState.duo;
  const t = battleState.phaseTime;
  const turn = battleState.turnIndex % 3;

  const intervalA = 350;
  const intervalB = 500;

  if (t - d.lastSpawnA > intervalA) {
    d.lastSpawnA = t;
    if (turn === 0) {
      spawnSideBullets(1.1);
    } else if (turn === 1) {
      spawnDownBullet(1.3);
    } else {
      spawnCrossBullets();
    }
  }

  if (t - d.lastSpawnB > intervalB) {
    d.lastSpawnB = t;
    if (turn === 0) {
      spawnTargetedBullet();
    } else if (turn === 1) {
      spawnDiagonalBullets(1.2);
    } else {
      spawnTargetedBullet();
    }
  }

  updateBulletsAndCollisions();

  const attackDuration = 4500;
  if (battleState.phaseTime > attackDuration && heart.alive) {
    endEnemyAttack();
  }
}

function updateEnemyAttack(dt) {
  if (!battleState) return;

  if (currentEnemyTypeId === "wizard_duo" && battleState.duo) {
    updateWizardDuoAttack(dt);
    return;
  }

  const type = enemyTypes[currentEnemyTypeId] || enemyTypes["dummy"];
  const patterns = type.patterns && type.patterns.length ? type.patterns : [0, 1, 2];
  const pattern = patterns[battleState.turnIndex % patterns.length];

  if (pattern === 0) {
    if (battleState.phaseTime - lastSpawn > 300) {
      lastSpawn = battleState.phaseTime;
      spawnDownBullet(1);
    }
  } else if (pattern === 1) {
    if (battleState.phaseTime - lastSpawn > 350) {
      lastSpawn = battleState.phaseTime;
      spawnSideBullets(1);
    }
  } else if (pattern === 2) {
    if (battleState.phaseTime - lastSpawn > 450) {
      lastSpawn = battleState.phaseTime;
      spawnDiagonalBullets(1);
    }
  } else if (pattern === 3) {
    if (battleState.phaseTime - lastSpawn > 200) {
      lastSpawn = battleState.phaseTime;
      spawnDownBullet(1.8);
    }
  } else if (pattern === 4) {
    if (battleState.phaseTime - lastSpawn > 550) {
      lastSpawn = battleState.phaseTime;
      spawnCrossBullets();
    }
  } else if (pattern === 5) {
    if (battleState.phaseTime - lastSpawn > 400) {
      lastSpawn = battleState.phaseTime;
      spawnTargetedBullet();
    }
  }

  updateBulletsAndCollisions();

  const attackDuration =
    currentEnemyTypeId === "trial_boss" ? 5500 : 4000;

  if (battleState.phaseTime > attackDuration && heart.alive) {
    endEnemyAttack();
  }
}

function updateBattle(dt) {
  if (!battleState) return;
  battleState.phaseTime += dt;

  switch (battleState.phase) {
    case "intro":
      break;
    case "playerTurn":
      bullets = [];
      break;
    case "attackQTE":
      updateAttackQTE(dt);
      break;
    case "enemyDialogue":
      break;
    case "enemyAttack":
      updateHeart();
      updateEnemyAttack(dt);
      break;
    case "itemMenu":
      break;
    case "end":
      break;
  }
}

// -------------------------
// BATTLE DRAW
// -------------------------
function drawBattleBox() {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    battleBox.x,
    battleBox.y,
    battleBox.width,
    battleBox.height
  );
}

function drawBattleHeart() {
  if (!heart.alive) return;
  drawHeartSprite(heart.x, heart.y, heart.size);
}

function drawBullets() {
  ctx.fillStyle = "#ffffff";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHPBars() {
  ctx.font = "14px sans-serif";
  ctx.textBaseline = "alphabetic";

  const barX = 40;
  const barY = 340;
  const barWidth = 200;
  const barHeight = 12;
  const ratio = heart.hp / heart.maxHp;

  ctx.fillStyle = "#ffffff";
  ctx.fillText(`HP: ${heart.hp}/${heart.maxHp}`, barX, barY - 4);

  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(
    barX + 1,
    barY + 1,
    (barWidth - 2) * ratio,
    barHeight - 2
  );

  if (battleState && battleState.duo && currentEnemyTypeId === "wizard_duo") {
    const d = battleState.duo;
    const eBarX = 340;
    const eBarY = 40;
    const eBarWidth = 220;
    const eBarHeight = 10;

    const ratioA = d.hp[0] / d.maxHp[0];
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${d.names[0]}: ${d.hp[0]}/${d.maxHp[0]}`,
      eBarX,
      eBarY - 4
    );
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(eBarX, eBarY, eBarWidth, eBarHeight);
    ctx.fillStyle = "#00bfff";
    ctx.fillRect(
      eBarX + 1,
      eBarY + 1,
      (eBarWidth - 2) * ratioA,
      eBarHeight - 2
    );

    const eBarY2 = eBarY + 24;
    const ratioB = d.hp[1] / d.maxHp[1];
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${d.names[1]}: ${d.hp[1]}/${d.maxHp[1]}`,
      eBarX,
      eBarY2 - 4
    );
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(eBarX, eBarY2, eBarWidth, eBarHeight);
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(
      eBarX + 1,
      eBarY2 + 1,
      (eBarWidth - 2) * ratioB,
      eBarHeight - 2
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    const targetIdx = d.targetIndex;
    const targName = d.names[targetIdx];
    ctx.fillText(
      `Target: ${targName}  [Q/E to switch]`,
      eBarX,
      eBarY2 + 18
    );
  } else {
    const eBarX = 360;
    const eBarY = 60;
    const eBarWidth = 200;
    const eBarHeight = 12;
    const eRatio = enemy.hp / enemy.maxHp;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${enemy.name}: ${enemy.hp}/${enemy.maxHp}`,
      eBarX,
      eBarY - 4
    );

    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(eBarX, eBarY, eBarWidth, eBarHeight);

    ctx.fillStyle = "#00ff00";
    ctx.fillRect(
      eBarX + 1,
      eBarY + 1,
      (eBarWidth - 2) * eRatio,
      eBarHeight - 2
    );
  }
}

function drawAttackQTE() {
  if (!attackQTE) return;

  const barWidth = 300;
  const barHeight = 8;
  const cx = canvas.width / 2;
  const x = cx - barWidth / 2;
  const y = 260;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barWidth, barHeight);

  const sweetWidth = 40;
  const sweetX = cx - sweetWidth / 2;
  ctx.fillStyle = "#444444";
  ctx.fillRect(sweetX, y, sweetWidth, barHeight);

  const markerX = x + attackQTE.pos * barWidth;
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(markerX - 3, y - 4, 6, barHeight + 8);
}

function drawBattleItemMenu() {
  if (!battleItemSelect.open) return;

  const boxX = 80;
  const boxY = 80;
  const boxW = canvas.width - 160;
  const boxH = 160;

  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("Choose an item (Z/Enter, Esc to cancel)", boxX + 10, boxY + 8);

  const listStartY = boxY + 30;
  const lineHeight = 18;

  if (battleItemSelect.items.length === 0) {
    ctx.fillText("No usable items.", boxX + 10, listStartY);
    return;
  }

  battleItemSelect.items.forEach((entry, idx) => {
    const y = listStartY + idx * lineHeight;
    if (idx === battleItemSelect.index) {
      ctx.fillText(">", boxX + 10, y);
    }
    ctx.fillText(
      `${entry.name} x${entry.qty} (+${entry.healAmount} HP)`,
      boxX + 24,
      y
    );
  });
}

function drawBattle() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentEnemyTypeId === "wizard_duo" && battleState && battleState.duo) {
    const cx = canvas.width / 2;
    const topY = 80;

    ctx.fillStyle = "#00bfff";
    ctx.fillRect(cx - 60, topY, 30, 40);

    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(cx + 30, topY, 30, 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Azure", cx - 70, topY + 44);
    ctx.fillText("Crimson", cx + 20, topY + 44);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(enemy.name, 280, 80);
  }

  drawBattleBox();
  drawBullets();
  drawBattleHeart();
  drawHPBars();

  if (battleState && battleState.phase === "attackQTE") {
    drawAttackQTE();
  }

  if (battleState && battleState.phase === "itemMenu") {
    drawBattleItemMenu();
  }

  drawStatsPanel();
}

// -------------------------
// BATTLE ITEM MENU LOGIC
// -------------------------
function openBattleItemMenu() {
  const items = [];
  inventory.forEach((invItem, idx) => {
    const def = itemDefs[invItem.id];
    if (
      def &&
      def.type === "consumable" &&
      def.battleUse === "heal" &&
      invItem.quantity > 0
    ) {
      items.push({
        invIndex: idx,
        id: invItem.id,
        name: def.name,
        qty: invItem.quantity,
        healAmount: def.healAmount || 5
      });
    }
  });

  if (items.length === 0) {
    setMessage(
      "You rummage in your pockets.\nNothing useful.",
      () => {
        startEnemyDialogue();
      }
    );
    return;
  }

  battleItemSelect.open = true;
  battleItemSelect.index = 0;
  battleItemSelect.items = items;
  battleState.phase = "itemMenu";
  battleState.phaseTime = 0;
  menuEl.style.display = "none";
  setMessage("You open your pack.");
}

function handleBattleItemKey(e) {
  if (!battleItemSelect.open || !battleState || battleState.phase !== "itemMenu") return;

  const upKeys = ["ArrowUp", "w", "W"];
  const downKeys = ["ArrowDown", "s", "S"];
  const confirmKeys = ["Enter", " ", "z", "Z"];
  const cancelKeys = ["Escape", "x", "X"];

  if (messageState.playing || pendingNextAction) {
    return;
  }

  if (upKeys.includes(e.key)) {
    e.preventDefault();
    const len = battleItemSelect.items.length;
    battleItemSelect.index =
      (battleItemSelect.index + len - 1) % len;
  } else if (downKeys.includes(e.key)) {
    e.preventDefault();
    const len = battleItemSelect.items.length;
    battleItemSelect.index =
      (battleItemSelect.index + 1) % len;
  } else if (confirmKeys.includes(e.key)) {
    e.preventDefault();
    useSelectedBattleItem();
  } else if (cancelKeys.includes(e.key)) {
    e.preventDefault();
    battleItemSelect.open = false;
    battleItemSelect.items = [];
    startPlayerTurn();
  }
}

function useSelectedBattleItem() {
  const entry = battleItemSelect.items[battleItemSelect.index];
  if (!entry) return;

  const invItem = inventory[entry.invIndex];
  const def = itemDefs[entry.id];
  if (!invItem || !def) return;

  const heal = def.healAmount || 5;

  if (heart.hp >= heart.maxHp) {
    setMessage("Your HP is already full.", () => {
      battleItemSelect.open = false;
      battleItemSelect.items = [];
      startEnemyDialogue();
    });
  } else {
    heart.hp = Math.min(heart.maxHp, heart.hp + heal);
    removeItem(entry.id, 1);
    setMessage(
      `You use ${def.name}.\nRecovered ${heal} HP.`,
      () => {
        battleItemSelect.open = false;
        battleItemSelect.items = [];
        startEnemyDialogue();
      }
    );
  }
}

// -------------------------
// PLAYER ACTIONS (MENU)
// -------------------------
function handlePlayerAction(action) {
  if (
    gameState !== "battle" ||
    !battleState ||
    battleState.phase !== "playerTurn" ||
    !heart.alive
  ) {
    return;
  }

  if (action === "attack") {
    startAttackQTE();
  } else if (action === "talk") {
    if (currentEnemyTypeId === "trial_boss") {
      setMessage(
        'Judge: "Words do not weigh enough here."\nThe air tightens around you.',
        () => {
          startEnemyDialogue();
        }
      );
    } else if (currentEnemyTypeId === "wizard_duo") {
      setMessage(
        "You try to talk.\nThey both insist the other started it.",
        () => {
          startEnemyDialogue();
        }
      );
    } else {
      setMessage("You try to talk.\nThe enemy stares back.", () => {
        startEnemyDialogue();
      });
    }
  } else if (action === "item") {
    openBattleItemMenu();
  } else if (action === "spare") {
    if (currentEnemyTypeId === "trial_boss") {
      setMessage(
        '"You cannot back down from this trial."',
        () => {
          startEnemyDialogue();
        }
      );
      return;
    }

    if (enemy.hp <= enemy.maxHp / 4) {
      setMessage(
        "You show mercy.\nThe enemy leaves peacefully.",
        () => {
          onEnemyDefeated();
        }
      );
    } else {
      setMessage(
        "The enemy doesn't\nseem ready to be spared.",
        () => {
          startEnemyDialogue();
        }
      );
    }
  }
}
