/**
 * ClickGUI Module
 */

function injectGUI(store) {
  const categories = {
    Combat: ["autoclicker", "killaura", "velocity", "wtap"],
    Movement: ["scaffold", "jesus", "phase", "nofall", "antifall", "sprint", "keepsprint", "step", "speed", "jetpack", "noslowdown"],
    RendLayer: ["invcleaner", "invwalk", "autoarmor", "esp", "nametags+", "textgui", "clickgui", "longjump"],
    World: ["fastbreak", "breaker", "autocraft", "cheststeal", "timer", "creativemode"],
    Utility: ["autorespawn", "autorejoin", "autoqueue", "autovote", "filterbypass", "anticheat", "autofunnychat", "chatdisabler", "musicfix", "auto-funnychat", "music-fix"]
  };

  const catIcons = { Combat: "⚔️", Movement: "🏃", "RendLayer": "🧑👁️", World: "🌍", Utility: "🛠️" };

  // === Styles ===
  const style = document.createElement("style");
  style.textContent =
    "@keyframes guiEnter {0%{opacity:0;transform:scale(0.9);}100%{opacity:1;transform:scale(1);}}" +
    ".lb-panel { position:absolute; width:220px; background:#111; border:2px solid #00aaff; font-family:\"Poppins\", sans-serif; color:white; animation:guiEnter .25s ease-out; z-index:100000; max-height:420px; overflow-x:hidden; }" +
    ".lb-panel::-webkit-scrollbar { width:6px; }" +
    ".lb-panel::-webkit-scrollbar-thumb { background:#00aaff; }" +
    ".lb-panel::-webkit-scrollbar-track { background:#111; }" +
    ".lb-header { background:#0a0a0a; padding:6px; font-weight:bold; cursor:move; user-select:none; text-align:center; border-bottom:1px solid #00aaff; }" +
    ".lb-module { padding:4px 8px; cursor:pointer; transition:background .15s; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center; }" +
    ".lb-module:hover { background:#222; }" +
    ".lb-module.enabled { background:#003366; color:#00aaff; }" +
    ".lb-module.enabled:hover { background:#004488; }" +
    ".lb-bind { font-size:10px; color:#666; }" +
    ".lb-settings { margin-left:8px; padding:2px 6px; background:#333; border:1px solid #555; font-size:10px; cursor:pointer; }" +
    ".lb-settings:hover { background:#444; }" +
    ".lb-option { padding:3px 12px; background:#1a1a1a; border-bottom:1px solid #333; font-size:11px; }" +
    ".lb-option input { background:#333; border:1px solid #555; color:white; padding:2px 4px; width:60px; margin-left:8px; }" +
    ".lb-option input[type='checkbox'] { width:auto; }" +
    ".lb-content.collapsed { display:none; }";
  document.head.appendChild(style);

  let panels = {};

  // === Create Panel ===
  function createPanel(category, x = 50, y = 50) {
    if (panels[category]) return panels[category];

    const panel = document.createElement("div");
    panel.className = "lb-panel";
    panel.style.left = x + "px";
    panel.style.top = y + "px";

    const header = document.createElement("div");
    header.className = "lb-header";

    const collapseBtn = document.createElement("span");
    collapseBtn.style.float = "right";
    collapseBtn.style.cursor = "pointer";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = catIcons[category] + " " + category;

    header.appendChild(titleSpan);
    header.appendChild(collapseBtn);

    panel.appendChild(header);

    // Position restoration
    const saved = localStorage.getItem("lb-pos-" + category);
    if (saved) {
      const { left, top } = JSON.parse(saved);
      panel.style.left = left;
      panel.style.top = top;
    }

    // Dragging functionality
    let dragging = false, offsetX, offsetY;
    header.addEventListener("mousedown", (e) => {
      dragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
    });
    document.addEventListener("mousemove", (e) => {
      if (dragging) {
        panel.style.left = e.clientX - offsetX + "px";
        panel.style.top = e.clientY - offsetY + "px";
      }
    });
    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        localStorage.setItem("lb-pos-" + category, JSON.stringify({
          left: panel.style.left,
          top: panel.style.top
        }));
      }
    });

    const contentWrap = document.createElement("div");
    contentWrap.className = "lb-content";

    // Collapse functionality
    let collapsed = localStorage.getItem("lb-collapsed-" + category) === "true";
    if (collapsed) contentWrap.classList.add("collapsed");
    collapseBtn.textContent = collapsed ? "[+]" : "[-]";

    collapseBtn.addEventListener("click", () => {
      collapsed = !collapsed;
      if (collapsed) contentWrap.classList.add("collapsed");
      else contentWrap.classList.remove("collapsed");
      collapseBtn.textContent = collapsed ? "[+]" : "[-]";
      localStorage.setItem("lb-collapsed-" + category, collapsed);
    });

    // Add modules
    const moduleNames = categories[category] || [];
    moduleNames.forEach(modName => {
      const module = store.modules[modName] || store.modules[modName.toLowerCase()];
      if (!module) return;

      const moduleDiv = document.createElement("div");
      moduleDiv.className = "lb-module " + (module.enabled ? "enabled" : "");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = module.name;
      moduleDiv.appendChild(nameSpan);

      const rightSide = document.createElement("div");
      rightSide.style.display = "flex";
      rightSide.style.alignItems = "center";

      if (module.bind) {
        const bindSpan = document.createElement("span");
        bindSpan.className = "lb-bind";
        bindSpan.textContent = "[" + module.bind + "]";
        rightSide.appendChild(bindSpan);
      }

      if (Object.keys(module.options).length > 0) {
        const settingsBtn = document.createElement("span");
        settingsBtn.className = "lb-settings";
        settingsBtn.textContent = "⚙";
        settingsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleSettings(moduleDiv, module);
        });
        rightSide.appendChild(settingsBtn);
      }

      moduleDiv.appendChild(rightSide);

      moduleDiv.addEventListener("click", () => {
        module.toggle();
        moduleDiv.className = "lb-module " + (module.enabled ? "enabled" : "");
      });

      contentWrap.appendChild(moduleDiv);
    });

    panel.appendChild(contentWrap);

    document.body.appendChild(panel);
    panels[category] = panel;
    return panel;
  }

  // === Settings Toggle ===
  function toggleSettings(moduleDiv, module) {
    const existing = moduleDiv.querySelector(".lb-option");
    if (existing) {
      // Remove all options
      let next = moduleDiv.nextSibling;
      while (next && next.classList?.contains("lb-option")) {
        const toRemove = next;
        next = next.nextSibling;
        toRemove.remove();
      }
      return;
    }

    // Add options
    Object.entries(module.options).forEach(([name, option]) => {
      const optionDiv = document.createElement("div");
      optionDiv.className = "lb-option";

      const label = document.createElement("span");
      label.textContent = name + ":";
      optionDiv.appendChild(label);

      if (option[0] === Boolean) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = option[1];
        checkbox.addEventListener("change", () => {
          option[1] = checkbox.checked;
        });
        optionDiv.appendChild(checkbox);
      } else {
        const input = document.createElement("input");
        input.type = option[0] === Number ? "number" : "text";
        input.value = option[1];
        input.addEventListener("input", () => {
          if (option[0] === Number) {
            const val = parseFloat(input.value);
            if (!isNaN(val)) option[1] = val;
          } else {
            option[1] = input.value;
          }
        });
        optionDiv.appendChild(input);
      }

      moduleDiv.parentNode.insertBefore(optionDiv, moduleDiv.nextSibling);
    });
  }

  // === Toggle GUI ===
  function toggleGUI() {
    const visible = Object.keys(panels).length > 0 && panels[Object.keys(panels)[0]].style.display !== "none";

    if (visible) {
      // Hide all panels
      Object.values(panels).forEach(panel => panel.style.display = "none");
    } else {
      // Show/create panels
      let offsetX = 50;
      Object.keys(categories).forEach(category => {
        const panel = createPanel(category, offsetX, 50);
        panel.style.display = "block";
        offsetX += 240;
      });
    }
  }

  // Bind to right shift
  window.addEventListener("keydown", (e) => {
    if (e.code === "ShiftRight") {
      toggleGUI();
    }
  });

  return { toggleGUI, createPanel };
}

// Create ClickGUI module
new Module("ClickGUI", function (callback) {
  // Initialize exactly like the original vav4inject_old.js
  (async function() {
    try {
      // Add Poppins font (like original)
      const fontLink = document.createElement("link");
      fontLink.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap";
      fontLink.rel = "stylesheet";
      document.head.appendChild(fontLink);

      // Wait for all modules to be loaded (like original)
      await new Promise((resolve) => {
        const loop = setInterval(() => {
          if (unsafeWindow?.globalThis?.[storeName]?.modules) {
            clearInterval(loop);
            resolve();
          }
        }, 20);
      });

      const store = unsafeWindow.globalThis[storeName];
      if (store && store.modules) {
        injectGUI(store);
      }
    } catch (err) {
      console.error("[ClickGUI] Init failed:", err);
    }
  })();
});