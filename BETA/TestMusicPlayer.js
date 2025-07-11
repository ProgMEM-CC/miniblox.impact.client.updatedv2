// ==UserScript==
// @name         Miniblox MusicBar Rainbow GUI (CG5 Full Playlist)
// @namespace    https://github.com/ModuleMaster64
// @version      4.0
// @description  Adds a draggable YouTube playlist music player to Miniblox.io with rainbow GUI styling
// @author       ModuleMaster64
// @match        *://miniblox.io/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // 🌈 Rainbow styling
  const style = document.createElement("style");
  style.innerHTML = `
    #musicBar {
      position: fixed;
      bottom: 15px;
      right: 15px;
      width: 380px;
      height: 240px;
      z-index: 9999;
      background: linear-gradient(135deg, red, orange, yellow, green, cyan, blue, violet);
      border-radius: 12px;
      box-shadow: 0 0 12px rgba(0,0,0,0.4);
      overflow: hidden;
      cursor: move;
    }
    #musicBar iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `;
  document.head.appendChild(style);

  // 🎵 Embed CG5's full original songs playlist
  const musicBar = document.createElement("div");
  musicBar.id = "musicBar";
  musicBar.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/videoseries?list=PLDN9cM3mgdchOJapJ8k3smJG64icIVMGr&autoplay=1"
      allow="autoplay; encrypted-media"
      allowfullscreen
    ></iframe>
  `;
  document.body.appendChild(musicBar);

  // 🖱️ Dragging logic
  let isDragging = false, offsetX = 0, offsetY = 0;
  musicBar.addEventListener("mousedown", e => {
    isDragging = true;
    offsetX = e.clientX - musicBar.offsetLeft;
    offsetY = e.clientY - musicBar.offsetTop;
  });
  document.addEventListener("mousemove", e => {
    if (isDragging) {
      musicBar.style.left = `${e.clientX - offsetX}px`;
      musicBar.style.top = `${e.clientY - offsetY}px`;
    }
  });
  document.addEventListener("mouseup", () => isDragging = false);
})();
