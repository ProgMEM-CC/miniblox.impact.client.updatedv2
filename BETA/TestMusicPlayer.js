// ==UserScript==
// @name         Miniblox MusicBar Rainbow GUI (YouTube)
// @namespace    https://github.com/ModuleMaster64
// @version      2.0
// @description  Adds a draggable YouTube music player to Miniblox.io with rainbow GUI styling and track switcher
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
      display: flex;
      flex-direction: column;
    }
    #musicControls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      background: rgba(0,0,0,0.2);
      color: white;
      font-family: sans-serif;
      font-size: 14px;
    }
    #musicControls select, #musicControls input {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 4px;
      border-radius: 6px;
    }
    #musicFrame {
      flex-grow: 1;
    }
    #musicFrame iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `;
  document.head.appendChild(style);

  // 🎵 Track list
  const tracks = {
    "Good To Be Alive": "GYtBoxGB6Wo",
    "Sleep Well": "TbWV7gCPiYc"
  };

  // 🎮 Create music bar
  const musicBar = document.createElement("div");
  musicBar.id = "musicBar";
  musicBar.innerHTML = `
    <div id="musicControls">
      <label>🎶 Track:</label>
      <select id="trackSelector">
        ${Object.keys(tracks).map(title => `<option value="${tracks[title]}">${title}</option>`).join("")}
      </select>
      <label>🔊 Volume:</label>
      <input type="range" id="volumeSlider" min="0" max="100" value="100">
    </div>
    <div id="musicFrame">
      <iframe id="ytPlayer" src="https://www.youtube.com/embed/${tracks["Good To Be Alive"]}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    </div>
  `;
  document.body.appendChild(musicBar);

  // 🔁 Track switching
  const selector = document.getElementById("trackSelector");
  const player = document.getElementById("ytPlayer");
  selector.addEventListener("change", () => {
    const videoId = selector.value;
    player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  });

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
