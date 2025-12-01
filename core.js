"use strict";

const canvas = document.getElementById("battleCanvas");
const ctx = canvas.getContext("2d");
const messageBox = document.getElementById("message");
const buttons = document.querySelectorAll(".menu button");
const menuEl = document.querySelector(".menu");
const saveBtn = document.getElementById("saveBtn");
const loadInput = document.getElementById("loadInput");

let gameState = "overworld"; // "overworld" | "battle"
const keys = {};
let battleState = null;
let lastTime = 0;

// -------------------------
// HEART SPRITE
// -------------------------
const heartImg = new Image();
heartImg.src = "Heart_Image_Coolio.png";
let heartImgLoaded = false;
heartImg.onload = () => {
  heartImgLoaded = true;
};

function drawHeartSprite(x, y, radius) {
  if (heartImgLoaded) {
    const size = radius * 2.5;
    ctx.drawImage(heartImg, x - size / 2, y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
