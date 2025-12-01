// js/editor.js

const data      = window.gameData;
const rooms     = data.rooms;
const items     = data.items;
const tilesets  = data.tilesets || {};
const decorDefs = data.decorDefs || {};

// Sidebar lists
const roomListEl = document.getElementById("roomList");
const itemListEl = document.getElementById("itemList");

const addRoomBtn = document.getElementById("addRoomBtn");
const addItemBtn = document.getElementById("addItemBtn");

// Room inspector fields
const roomIdInput = document.getElementById("roomIdInput");
const roomNameInput = document.getElementById("roomNameInput");
const roomWidthInput = document.getElementById("roomWidthInput");
const roomHeightInput = document.getElementById("roomHeightInput");
const npcTableBody = document.getElementById("npcTableBody");
const addNpcBtn = document.getElementById("addNpcBtn");

// Tabs
const roomInspectorTab = document.getElementById("roomInspectorTab");
const roomMapTab = document.getElementById("roomMapTab");
const roomInspectorSection = document.getElementById("roomInspectorSection");
const roomMapSection = document.getElementById("roomMapSection");

// Mini-map canvas + tools
const roomCanvas = document.getElementById("roomCanvas");
const roomCtx = roomCanvas.getContext("2d");

const toolSelectBtn = document.getElementById("toolSelectBtn");
const toolAddWallBtn = document.getElementById("toolAddWallBtn");
const toolAddDoorBtn = document.getElementById("toolAddDoorBtn");
const toolTilePaintBtn = document.getElementById("toolTilePaintBtn");
const toolDecorBtn = document.getElementById("toolDecorBtn");
const deleteRectBtn = document.getElementById("deleteRectBtn");

// Tileset palette
const tilesetSelect = document.getElementById("tilesetSelect");
const tilesetCanvas = document.getElementById("tilesetCanvas");
const tilesetCtx = tilesetCanvas.getContext("2d");

// Decor palette
const decorSelect = document.getElementById("decorSelect");

// Item editor fields
const itemIdInput = document.getElementById("itemIdInput");
const itemNameInput = document.getElementById("itemNameInput");
const itemTypeInput = document.getElementById("itemTypeInput");
const itemPowerInput = document.getElementById("itemPowerInput");
const itemDefenseInput = document.getElementById("itemDefenseInput");
const itemHealInput = document.getElementById("itemHealInput");
const itemDescInput = document.getElementById("itemDescInput");

// Export buttons
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportJsBtn = document.getElementById("exportJsBtn");

let selectedRoomId = null;
let selectedItemId = null;

// Tileset images for preview
const tilesetImages = {};

// -------------------------
// Mini-map state
// -------------------------
const mapState = {
  tool: "select", // "select" | "addWall" | "addDoor" | "tilePaint" | "decor"
  selectedKind: null, // "wall" | "door"
  selectedIndex: -1,
  dragging: false,
  dragType: null, // "move" | "create" | "paint"
  dragStartRoomX: 0,
  dragStartRoomY: 0,
  origX: 0,
  origY: 0,
  tempRect: null,
  scaleX: 1,
  scaleY: 1,
  currentTilesetId: null,
  currentTileIndex: 0,
  currentDecorId: null
};

// -------------------------
// Helpers
// -------------------------
function ensureRoomTileLayer(room) {
  if (!room.tileLayer) {
    const tsId = mapState.currentTilesetId || Object.keys(tilesets)[0];
    const ts = tilesets[tsId];
    const tw = ts?.tileWidth || 32;
    const th = ts?.tileHeight || 32;
    const rw = room.width || 800;
    const rh = room.height || 600;
    const gridWidth = Math.ceil(rw / tw);
    const gridHeight = Math.ceil(rh / th);
    room.tileLayer = {
      tilesetId: tsId,
      tileWidth: tw,
      tileHeight: th,
      gridWidth,
      gridHeight,
      tiles: new Array(gridWidth * gridHeight).fill(-1)
    };
  }
}

function ensureRoomDecor(room) {
  if (!room.decor) room.decor = [];
}

// -------------------------
// Sidebar lists
// -------------------------
function refreshRoomList() {
  roomListEl.innerHTML = "";
  Object.keys(rooms).forEach((id) => {
    const room = rooms[id];
    const li = document.createElement("li");
    li.textContent = `${id} – ${room.name || ""}`;
    if (id === selectedRoomId) li.classList.add("selected");
    li.addEventListener("click", () => selectRoom(id));
    roomListEl.appendChild(li);
  });
}

function refreshItemList() {
  itemListEl.innerHTML = "";
  Object.keys(items).forEach((id) => {
    const it = items[id];
    const li = document.createElement("li");
    li.textContent = `${id} – ${it.name || ""}`;
    if (id === selectedItemId) li.classList.add("selected");
    li.addEventListener("click", () => selectItem(id));
    itemListEl.appendChild(li);
  });
}

// -------------------------
// Tileset & decor palettes
// -------------------------
function initTilesetImages() {
  Object.keys(tilesets).forEach(id => {
    const ts = tilesets[id];
    if (!ts || !ts.image) return;
    if (tilesetImages[id]) return;
    const img = new Image();
    img.src = ts.image;
    tilesetImages[id] = img;
    ts.imageObj = img;
    img.onload = () => {
      if (!mapState.currentTilesetId) {
        mapState.currentTilesetId = id;
        tilesetSelect.value = id;
      }
      drawTilesetPalette();
      renderRoomMap();
    };
  });
}

function refreshTilesetSelect() {
  tilesetSelect.innerHTML = "";
  const ids = Object.keys(tilesets);
  ids.forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    tilesetSelect.appendChild(opt);
  });
  if (!mapState.currentTilesetId && ids.length > 0) {
    mapState.currentTilesetId = ids[0];
  }
  if (mapState.currentTilesetId) {
    tilesetSelect.value = mapState.currentTilesetId;
  }
  drawTilesetPalette();
}

function drawTilesetPalette() {
  const tsId = mapState.currentTilesetId;
  const ts = tilesets[tsId];
  if (!ts) {
    tilesetCtx.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
    return;
  }
  const img = ts.imageObj;
  if (!img || !img.complete) {
    tilesetCtx.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
    tilesetCtx.fillStyle = "#333";
    tilesetCtx.fillRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
    tilesetCtx.fillStyle = "#aaa";
    tilesetCtx.fillText("Loading...", 4, 14);
    return;
  }

  const tw = ts.tileWidth;
  const th = ts.tileHeight;

  tilesetCanvas.width = img.width;
  tilesetCanvas.height = img.height;

  tilesetCtx.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
  tilesetCtx.drawImage(img, 0, 0);

  const cols = ts.columns || Math.floor(img.width / tw);
  const tileIndex = mapState.currentTileIndex || 0;
  const tx = tileIndex % cols;
  const ty = Math.floor(tileIndex / cols);

  tilesetCtx.strokeStyle = "#ffff00";
  tilesetCtx.lineWidth = 2;
  tilesetCtx.strokeRect(
    tx * tw + 0.5,
    ty * th + 0.5,
    tw - 1,
    th - 1
  );
}

tilesetCanvas.addEventListener("mousedown", (e) => {
  const rect = tilesetCanvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (tilesetCanvas.width / rect.width);
  const py = (e.clientY - rect.top) * (tilesetCanvas.height / rect.height);

  const tsId = mapState.currentTilesetId;
  const ts = tilesets[tsId];
  if (!ts) return;
  const tw = ts.tileWidth;
  const th = ts.tileHeight;
  const img = ts.imageObj;
  if (!img) return;

  const cols = ts.columns || Math.floor(img.width / tw);
  const tx = Math.floor(px / tw);
  const ty = Math.floor(py / th);
  const index = ty * cols + tx;

  mapState.currentTileIndex = index;
  drawTilesetPalette();
});

tilesetSelect.addEventListener("change", () => {
  mapState.currentTilesetId = tilesetSelect.value;
  drawTilesetPalette();
  renderRoomMap();
});

function refreshDecorSelect() {
  decorSelect.innerHTML = "";
  const ids = Object.keys(decorDefs);
  ids.forEach(id => {
    const def = decorDefs[id];
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = def?.name ? `${id} – ${def.name}` : id;
    decorSelect.appendChild(opt);
  });
  if (ids.length > 0 && !mapState.currentDecorId) {
    mapState.currentDecorId = ids[0];
  }
  if (mapState.currentDecorId) {
    decorSelect.value = mapState.currentDecorId;
  }
}

decorSelect.addEventListener("change", () => {
  mapState.currentDecorId = decorSelect.value;
});

// -------------------------
// Room selection & inspector
// -------------------------
function selectRoom(id) {
  selectedRoomId = id;
  refreshRoomList();
  const room = rooms[id];
  if (!room) {
    renderRoomMap();
    return;
  }

  roomIdInput.value = id;
  roomNameInput.value = room.name || "";
  roomWidthInput.value = room.width || 0;
  roomHeightInput.value = room.height || 0;

  renderNpcTable(room);
  renderRoomMap();
}

function renderNpcTable(room) {
  npcTableBody.innerHTML = "";
  const npcs = room.npcs || [];
  npcs.forEach((npc, index) => {
    const tr = document.createElement("tr");

    // ID
    const tdId = document.createElement("td");
    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.value = npc.id || "";
    idInput.addEventListener("change", () => {
      npc.id = idInput.value.trim();
    });
    tdId.appendChild(idInput);
    tr.appendChild(tdId);

    // Label
    const tdLabel = document.createElement("td");
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = npc.label || "";
    labelInput.addEventListener("change", () => {
      npc.label = labelInput.value;
    });
    tdLabel.appendChild(labelInput);
    tr.appendChild(tdLabel);

    // X
    const tdX = document.createElement("td");
    const xInput = document.createElement("input");
    xInput.type = "number";
    xInput.value = npc.x || 0;
    xInput.addEventListener("change", () => {
      npc.x = Number(xInput.value) || 0;
      renderRoomMap();
    });
    tdX.appendChild(xInput);
    tr.appendChild(tdX);

    // Y
    const tdY = document.createElement("td");
    const yInput = document.createElement("input");
    yInput.type = "number";
    yInput.value = npc.y || 0;
    yInput.addEventListener("change", () => {
      npc.y = Number(yInput.value) || 0;
      renderRoomMap();
    });
    tdY.appendChild(yInput);
    tr.appendChild(tdY);

    // Battle?
    const tdBattle = document.createElement("td");
    const battleCheckbox = document.createElement("input");
    battleCheckbox.type = "checkbox";
    battleCheckbox.checked = !!npc.hasBattle;
    battleCheckbox.addEventListener("change", () => {
      npc.hasBattle = battleCheckbox.checked;
    });
    tdBattle.appendChild(battleCheckbox);
    tr.appendChild(tdBattle);

    // Delete
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "X";
    delBtn.className = "small-btn";
    delBtn.addEventListener("click", () => {
      npcs.splice(index, 1);
      renderNpcTable(room);
      renderRoomMap();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    npcTableBody.appendChild(tr);
  });
}

function addRoom() {
  const baseId = "new_room";
  let id = baseId;
  let counter = 1;
  while (rooms[id]) {
    id = baseId + "_" + counter++;
  }
  rooms[id] = {
    id,
    name: "New Room",
    width: 800,
    height: 600,
    walls: [],
    doors: [],
    npcs: [],
    tileLayer: null,
    decor: []
  };
  selectRoom(id);
  refreshRoomList();
}

// Field changes
roomNameInput.addEventListener("change", () => {
  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  room.name = roomNameInput.value;
  refreshRoomList();
});

roomWidthInput.addEventListener("change", () => {
  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  room.width = Number(roomWidthInput.value) || 0;
  renderRoomMap();
});

roomHeightInput.addEventListener("change", () => {
  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  room.height = Number(roomHeightInput.value) || 0;
  renderRoomMap();
});

addNpcBtn.addEventListener("click", () => {
  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  if (!room.npcs) room.npcs = [];
  room.npcs.push({
    id: "npc_" + room.npcs.length,
    label: "NPC",
    x: 100,
    y: 100,
    width: 24,
    height: 32,
    hasBattle: false
  });
  renderNpcTable(room);
  renderRoomMap();
});

// -------------------------
// Mini-map tools & tabs
// -------------------------
function setMapTool(tool) {
  mapState.tool = tool;
  toolSelectBtn.classList.toggle("active", tool === "select");
  toolAddWallBtn.classList.toggle("active", tool === "addWall");
  toolAddDoorBtn.classList.toggle("active", tool === "addDoor");
  toolTilePaintBtn.classList.toggle("active", tool === "tilePaint");
  toolDecorBtn.classList.toggle("active", tool === "decor");
}

toolSelectBtn.addEventListener("click", () => setMapTool("select"));
toolAddWallBtn.addEventListener("click", () => setMapTool("addWall"));
toolAddDoorBtn.addEventListener("click", () => setMapTool("addDoor"));
toolTilePaintBtn.addEventListener("click", () => setMapTool("tilePaint"));
toolDecorBtn.addEventListener("click", () => setMapTool("decor"));

deleteRectBtn.addEventListener("click", () => {
  if (!selectedRoomId || !mapState.selectedKind) return;
  const room = rooms[selectedRoomId];
  const arr =
    mapState.selectedKind === "wall" ? room.walls : room.doors;
  if (!arr) return;
  if (
    mapState.selectedIndex >= 0 &&
    mapState.selectedIndex < arr.length
  ) {
    arr.splice(mapState.selectedIndex, 1);
  }
  mapState.selectedKind = null;
  mapState.selectedIndex = -1;
  renderRoomMap();
});

// Tabs switching
function showInspectorTab() {
  roomInspectorTab.classList.add("active");
  roomMapTab.classList.remove("active");
  roomInspectorSection.style.display = "block";
  roomMapSection.style.display = "none";
}

function showMapTab() {
  roomInspectorTab.classList.remove("active");
  roomMapTab.classList.add("active");
  roomInspectorSection.style.display = "none";
  roomMapSection.style.display = "block";
  renderRoomMap();
}

roomInspectorTab.addEventListener("click", showInspectorTab);
roomMapTab.addEventListener("click", showMapTab);

// -------------------------
// Mini-map rendering
// -------------------------
function renderRoomMap() {
  const cw = roomCanvas.width;
  const ch = roomCanvas.height;

  roomCtx.fillStyle = "#050505";
  roomCtx.fillRect(0, 0, cw, ch);

  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  if (!room) return;

  const rw = room.width || 1;
  const rh = room.height || 1;

  const scaleX = cw / rw;
  const scaleY = ch / rh;
  mapState.scaleX = scaleX;
  mapState.scaleY = scaleY;

  // Room bounds
  roomCtx.strokeStyle = "#444";
  roomCtx.lineWidth = 1;
  roomCtx.strokeRect(0, 0, rw * scaleX, rh * scaleY);

  // Tiles
  drawRoomTilesMini(room);

  // Walls
  if (room.walls) {
    room.walls.forEach((w, idx) => {
      const x = w.x * scaleX;
      const y = w.y * scaleY;
      const width = w.width * scaleX;
      const height = w.height * scaleY;

      roomCtx.fillStyle = "#555555";
      roomCtx.fillRect(x, y, width, height);

      if (
        mapState.selectedKind === "wall" &&
        mapState.selectedIndex === idx
      ) {
        roomCtx.strokeStyle = "#ffff00";
        roomCtx.lineWidth = 2;
        roomCtx.strokeRect(x, y, width, height);
      }
    });
  }

  // Doors
  if (room.doors) {
    room.doors.forEach((d, idx) => {
      const x = d.x * scaleX;
      const y = d.y * scaleY;
      const width = d.width * scaleX;
      const height = d.height * scaleY;

      roomCtx.fillStyle = "#0c7f3c";
      roomCtx.fillRect(x, y, width, height);

      if (
        mapState.selectedKind === "door" &&
        mapState.selectedIndex === idx
      ) {
        roomCtx.strokeStyle = "#ffff00";
        roomCtx.lineWidth = 2;
        roomCtx.strokeRect(x, y, width, height);
      }
    });
  }

  // NPCs
  if (room.npcs) {
    room.npcs.forEach((npc) => {
      const x = npc.x * scaleX;
      const y = npc.y * scaleX; // y uses scaleX or scaleY? Use scaleY
    });
  }

  if (room.npcs) {
    room.npcs.forEach((npc) => {
      const x = npc.x * scaleX;
      const y = npc.y * scaleY;
      const w = (npc.width || 24) * scaleX;
      const h = (npc.height || 32) * scaleY;
      roomCtx.fillStyle = "#ffff00";
      roomCtx.fillRect(x, y, w, h);
    });
  }

  // Decor (cyan squares)
  if (room.decor) {
    room.decor.forEach((inst) => {
      const x = inst.x * scaleX;
      const y = inst.y * scaleY;
      const size = 12;
      roomCtx.fillStyle = "#00bcd4";
      roomCtx.fillRect(x - size / 2, y - size / 2, size, size);
    });
  }

  // Temp rect during creation
  if (mapState.tempRect) {
    const r = mapState.tempRect;
    const x = r.x * scaleX;
    const y = r.y * scaleY;
    const width = r.width * scaleX;
    const height = r.height * scaleY;
    roomCtx.strokeStyle = "#aaaaaa";
    roomCtx.lineWidth = 1;
    roomCtx.setLineDash([4, 3]);
    roomCtx.strokeRect(x, y, width, height);
    roomCtx.setLineDash([]);
  }
}

function drawRoomTilesMini(room) {
  const layer = room.tileLayer;
  if (!layer || !layer.tiles || !layer.tiles.length) return;

  const ts = tilesets[layer.tilesetId];
  if (!ts) return;
  const img = ts.imageObj;
  const tw = layer.tileWidth  || ts.tileWidth;
  const th = layer.tileHeight || ts.tileHeight;
  const gridW = layer.gridWidth;
  const gridH = layer.gridHeight;
  const cols = ts.columns || Math.floor((img?.width || (gridW * tw)) / tw);

  const scaleX = mapState.scaleX;
  const scaleY = mapState.scaleY;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const tileIndex = layer.tiles[gy * gridW + gx];
      if (tileIndex == null || tileIndex < 0) continue;

      const worldX = gx * tw;
      const worldY = gy * th;
      const screenX = worldX * scaleX;
      const screenY = worldY * scaleY;
      const screenW = tw * scaleX;
      const screenH = th * scaleY;

      if (img && img.complete) {
        const sx = (tileIndex % cols) * tw;
        const sy = Math.floor(tileIndex / cols) * th;
        roomCtx.drawImage(img, sx, sy, tw, th, screenX, screenY, screenW, screenH);
      } else {
        roomCtx.fillStyle = "#333";
        roomCtx.fillRect(screenX, screenY, screenW, screenH);
      }
    }
  }
}

// -------------------------
// Mini-map mouse handling
// -------------------------
function getRoomCoordsFromMouse(evt) {
  const rect = roomCanvas.getBoundingClientRect();

  const pixelX =
    (evt.clientX - rect.left) * (roomCanvas.width / rect.width);
  const pixelY =
    (evt.clientY - rect.top) * (roomCanvas.height / rect.height);

  const roomX = pixelX / mapState.scaleX;
  const roomY = pixelY / mapState.scaleY;

  return { roomX, roomY, pixelX, pixelY };
}

function pickRect(room, roomX, roomY) {
  // Doors on top, then walls
  if (room.doors) {
    for (let i = room.doors.length - 1; i >= 0; i--) {
      const d = room.doors[i];
      if (
        roomX >= d.x &&
        roomX <= d.x + d.width &&
        roomY >= d.y &&
        roomY <= d.y + d.height
      ) {
        return { kind: "door", index: i, rect: d };
      }
    }
  }
  if (room.walls) {
    for (let i = room.walls.length - 1; i >= 0; i--) {
      const w = room.walls[i];
      if (
        roomX >= w.x &&
        roomX <= w.x + w.width &&
        roomY >= w.y &&
        roomY <= w.y + w.height
      ) {
        return { kind: "wall", index: i, rect: w };
      }
    }
  }
  return null;
}

function paintTileAt(room, roomX, roomY) {
  ensureRoomTileLayer(room);
  const layer = room.tileLayer;
  const ts = tilesets[layer.tilesetId];
  const tw = layer.tileWidth  || ts.tileWidth;
  const th = layer.tileHeight || ts.tileHeight;

  const gx = Math.floor(roomX / tw);
  const gy = Math.floor(roomY / th);
  if (gx < 0 || gy < 0 || gx >= layer.gridWidth || gy >= layer.gridHeight) return;

  const idx = gy * layer.gridWidth + gx;
  layer.tiles[idx] = mapState.currentTileIndex || 0;
}

function placeDecorAt(room, roomX, roomY) {
  if (!mapState.currentDecorId) return;
  ensureRoomDecor(room);
  room.decor.push({
    id: mapState.currentDecorId + "_" + room.decor.length,
    decorId: mapState.currentDecorId,
    x: roomX,
    y: roomY
  });
}

roomCanvas.addEventListener("mousedown", (e) => {
  if (!selectedRoomId) return;
  const room = rooms[selectedRoomId];
  if (!room) return;

  const { roomX, roomY } = getRoomCoordsFromMouse(e);

  if (mapState.tool === "tilePaint") {
    paintTileAt(room, roomX, roomY);
    mapState.dragging = true;
    mapState.dragType = "paint";
    renderRoomMap();
    return;
  }

  if (mapState.tool === "decor") {
    placeDecorAt(room, roomX, roomY);
    renderRoomMap();
    return;
  }

  if (mapState.tool === "addWall" || mapState.tool === "addDoor") {
    mapState.dragging = true;
    mapState.dragType = "create";
    mapState.dragStartRoomX = roomX;
    mapState.dragStartRoomY = roomY;
    mapState.tempRect = {
      x: roomX,
      y: roomY,
      width: 0,
      height: 0
    };
  } else {
    const hit = pickRect(room, roomX, roomY);
    if (hit) {
      mapState.selectedKind = hit.kind;
      mapState.selectedIndex = hit.index;
      mapState.dragging = true;
      mapState.dragType = "move";
      mapState.dragStartRoomX = roomX;
      mapState.dragStartRoomY = roomY;
      mapState.origX = hit.rect.x;
      mapState.origY = hit.rect.y;
    } else {
      mapState.selectedKind = null;
      mapState.selectedIndex = -1;
    }
  }
  renderRoomMap();
});

roomCanvas.addEventListener("mousemove", (e) => {
  if (!mapState.dragging || !selectedRoomId) return;
  const room = rooms[selectedRoomId];
  if (!room) return;

  const { roomX, roomY } = getRoomCoordsFromMouse(e);

  if (mapState.dragType === "paint" && mapState.tool === "tilePaint") {
    paintTileAt(room, roomX, roomY);
    renderRoomMap();
    return;
  }

  if (mapState.dragType === "create" && mapState.tempRect) {
    const r = mapState.tempRect;
    r.x = Math.min(mapState.dragStartRoomX, roomX);
    r.y = Math.min(mapState.dragStartRoomY, roomY);
    r.width = Math.abs(roomX - mapState.dragStartRoomX);
    r.height = Math.abs(roomY - mapState.dragStartRoomY);
  } else if (mapState.dragType === "move") {
    const dx = roomX - mapState.dragStartRoomX;
    const dy = roomY - mapState.dragStartRoomY;
    const arr =
      mapState.selectedKind === "wall" ? room.walls : room.doors;
    if (!arr) return;
    const rect = arr[mapState.selectedIndex];
    rect.x = mapState.origX + dx;
    rect.y = mapState.origY + dy;
  }

  renderRoomMap();
});

function endMapDrag() {
  if (!mapState.dragging || !selectedRoomId) {
    mapState.dragging = false;
    mapState.dragType = null;
    mapState.tempRect = null;
    return;
  }

  const room = rooms[selectedRoomId];
  if (!room) {
    mapState.dragging = false;
    mapState.dragType = null;
    mapState.tempRect = null;
    return;
  }

  if (mapState.dragType === "create" && mapState.tempRect) {
    const r = mapState.tempRect;
    if (r.width > 10 && r.height > 10) {
      if (!room.walls) room.walls = [];
      if (!room.doors) room.doors = [];
      const arr =
        mapState.tool === "addWall" ? room.walls : room.doors;
      const rect = {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height)
      };
      arr.push(rect);
      mapState.selectedKind =
        mapState.tool === "addWall" ? "wall" : "door";
      mapState.selectedIndex = arr.length - 1;
    }
  }

  mapState.dragging = false;
  mapState.dragType = null;
  mapState.tempRect = null;
  renderRoomMap();
}

roomCanvas.addEventListener("mouseup", endMapDrag);
roomCanvas.addEventListener("mouseleave", () => {
  if (mapState.dragging) endMapDrag();
});

// -------------------------
// Item editing
// -------------------------
function selectItem(id) {
  selectedItemId = id;
  refreshItemList();
  const it = items[id];
  if (!it) return;

  itemIdInput.value = id;
  itemNameInput.value = it.name || "";
  itemTypeInput.value = it.type || "quest";
  itemPowerInput.value = it.power || 0;
  itemDefenseInput.value = it.defense || 0;
  itemHealInput.value = it.healAmount || 0;
  itemDescInput.value = it.description || "";
}

function addItem() {
  const baseId = "new_item";
  let id = baseId;
  let counter = 1;
  while (items[id]) {
    id = baseId + "_" + counter++;
  }
  items[id] = {
    name: "New Item",
    type: "quest",
    description: ""
  };
  selectItem(id);
  refreshItemList();
}

// Item field change handlers
itemNameInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  items[selectedItemId].name = itemNameInput.value;
  refreshItemList();
});

itemTypeInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  items[selectedItemId].type = itemTypeInput.value;
});

itemPowerInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  const v = Number(itemPowerInput.value) || 0;
  items[selectedItemId].power = v;
});

itemDefenseInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  const v = Number(itemDefenseInput.value) || 0;
  items[selectedItemId].defense = v;
});

itemHealInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  const v = Number(itemHealInput.value) || 0;
  items[selectedItemId].healAmount = v;
  if (v > 0) {
    const it = items[selectedItemId];
    if (!it.battleUse) it.battleUse = "heal";
  }
});

itemDescInput.addEventListener("change", () => {
  if (!selectedItemId) return;
  items[selectedItemId].description = itemDescInput.value;
});

// -------------------------
// Export
// -------------------------
function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

exportJsonBtn.addEventListener("click", () => {
  const json = JSON.stringify(window.gameData, null, 2);
  downloadFile("gameData.json", json, "application/json");
});

exportJsBtn.addEventListener("click", () => {
  const json = JSON.stringify(window.gameData, null, 2);
  const js = "window.gameData = " + json + ";\n";
  downloadFile("gameData.js", js, "application/javascript");
});

// -------------------------
// Sidebar buttons
// -------------------------
addRoomBtn.addEventListener("click", addRoom);
addItemBtn.addEventListener("click", addItem);

// -------------------------
// Init
// -------------------------
refreshRoomList();
refreshItemList();
initTilesetImages();
refreshTilesetSelect();
refreshDecorSelect();

const firstRoomId = Object.keys(rooms)[0];
if (firstRoomId) selectRoom(firstRoomId);
const firstItemId = Object.keys(items)[0];
if (firstItemId) selectItem(firstItemId);

// default to Inspector tab & select tool
showInspectorTab();
setMapTool("select");
