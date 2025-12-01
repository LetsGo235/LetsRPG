// -------------------------
// TYPEWRITER TEXT + NEXT ACTION
// -------------------------
const messageState = {
  full: "",
  visible: "",
  index: 0,
  speed: 25,
  timer: 0,
  playing: false
};

let textSoundCooldown = 0;
let pendingNextAction = null;

function setMessage(text, nextAction) {
  messageState.full = text || "";
  messageState.visible = "";
  messageState.index = 0;
  messageState.timer = 0;
  messageState.playing = messageState.full.length > 0;
  messageBox.textContent = "";
  pendingNextAction = typeof nextAction === "function" ? nextAction : null;
}

function updateMessage(dt) {
  if (!messageState.playing) return;

  messageState.timer += dt;
  textSoundCooldown -= dt;
  if (textSoundCooldown < 0) textSoundCooldown = 0;

  const charsToShow = Math.floor(messageState.timer / messageState.speed);

  while (
    messageState.index < charsToShow &&
    messageState.index < messageState.full.length
  ) {
    const ch = messageState.full[messageState.index];
    messageState.visible += ch;
    messageState.index++;

    if (ch !== " " && ch !== "\n" && textSoundCooldown <= 0) {
      playSfx(sfxText);
      textSoundCooldown = 40;
    }
  }

  if (messageState.index >= messageState.full.length) {
    messageState.playing = false;
  }

  messageBox.textContent = messageState.visible;
}

function completeMessageInstantly() {
  messageState.visible = messageState.full;
  messageState.index = messageState.full.length;
  messageState.playing = false;
  messageBox.textContent = messageState.visible;
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line ? line + " " + words[n] : words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

// -------------------------
// MENU NAVIGATION
// -------------------------
let menuIndex = 0;

function updateMenuHighlight() {
  buttons.forEach((btn, idx) => {
    if (idx === menuIndex) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}
