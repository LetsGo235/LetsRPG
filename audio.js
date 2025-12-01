// -------------------------
// SOUND EFFECTS
// -------------------------
function loadSfx(fileName, volume = 0.8) {
  const audio = new Audio(fileName);
  audio.volume = volume;
  return audio;
}

const sfxMenuMove    = loadSfx("SFX_Menu_Move.wav", 0.5);
const sfxMenuConfirm = loadSfx("SFX_Menu_Confirm.wav", 0.6);
const sfxHit         = loadSfx("SFX_Hit.wav", 0.7);
const sfxHurt        = loadSfx("SFX_Hurt.wav", 0.7);
const sfxText        = loadSfx("SFX_Text_Blip.wav", 0.4);

function playSfx(sfx) {
  if (!sfx) return;
  try {
    sfx.currentTime = 0;
    sfx.play();
  } catch (e) {}
}

// -------------------------
// MUSIC (BGM)
// -------------------------
function loadBgm(fileName, volume = 0.6) {
  const audio = new Audio(fileName);
  audio.loop = true;
  audio.volume = volume;
  return audio;
}

const bgm = {
  overworld: loadBgm("BGM_Overworld.mp3", 0.5),
  battle:    loadBgm("BGM_Battle.mp3",     0.5),
  boss:      loadBgm("BGM_Boss.mp3",       0.6)
};

let currentBgm = null;
let audioReady = false;

function playBgm(kind) {
  if (!audioReady) return;
  const track = bgm[kind];
  if (track === currentBgm) return;

  if (currentBgm) {
    try {
      currentBgm.pause();
      currentBgm.currentTime = 0;
    } catch (e) {}
  }

  currentBgm = track;
  if (currentBgm) {
    try {
      currentBgm.play();
    } catch (e) {}
  }
}

function initAudioOnce() {
  if (audioReady) return;
  audioReady = true;
  playBgm("overworld");
}

window.addEventListener(
  "keydown",
  function firstKey() {
    initAudioOnce();
    window.removeEventListener("keydown", firstKey);
  },
  { once: true }
);
