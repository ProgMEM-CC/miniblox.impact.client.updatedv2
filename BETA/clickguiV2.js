// 2nd ClickGUI - You can use this here or use @dtkiller-jp's one! I might recode this.
(async function () {
  try {
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    await new Promise((resolve) => {
      const loop = setInterval(() => {
        if (unsafeWindow?.globalThis?.[storeName]?.modules) {
          clearInterval(loop);
          resolve();
        }
      }, 20);
    });

    injectGUI(unsafeWindow.globalThis[storeName]);
  } catch (err) {
    console.error("[ClickGUI] has Init failed:", err);
  }

  function injectGUI(store) {
    const categories = {
      Combat: ["autoclicker", "killaura", "velocity", "wtap"],
      Movement: ["scaffold","jesus","phase","nofall","sprint","keepsprint","step","speed","jetpack","noslowdown"],
      RendLayer: ["invcleaner","invwalk","autoarmor","esp","textgui","clickgui","longjump"],
      World: ["fastbreak","breaker","autocraft","cheststeal","timer","creativemode","targethud"],
      Utility: ["autorespawn","autorejoin","autoqueue","autovote","filterbypass","anticheat","autofunnychat","chatdisabler","musicfix","auto-funnychat","music-fix"]
    };
    const catIcons = { Combat:"⚔️", Movement:"🏃", "RendLayer":"🧑👁️", World:"🌍", Utility:"🛠️" };

    // === Styles ===
    const style = document.createElement("style");
    style.textContent = `
      @keyframes guiEnter {0%{opacity:0;transform:scale(0.9);}100%{opacity:1;transform:scale(1);}}
      .lb-panel { position:absolute; width:220px; background:#111; border:2px solid #00aaff; font-family:"Poppins", sans-serif; color:white; animation:guiEnter .25s ease-out; z-index:100000; max-height:420px; overflow-x:hidden; }
      .lb-panel::-webkit-scrollbar { width:6px; }
      .lb-panel::-webkit-scrollbar-thumb { background:#00aaff; }
      .lb-panel::-webkit-scrollbar-track { background:#111; }
      .lb-header { background:#0a0a0a; padding:6px; font-weight:600; cursor:move; text-align:center; border-bottom:1px solid #00aaff; }
      .lb-module { padding:4px 6px; border-bottom:1px solid #1b1b1b; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
      .lb-module:hover { background:#151a20; }
      .lb-module.active { color:#00aaff; }
      .lb-options { display:none; flex-direction:column; gap:4px; padding:4px 6px; background:#0f0f12; border-top:1px dashed #1e1e1e; }
      .lb-options.show { display:flex; animation:guiEnter .2s ease-out; }
      .lb-options label { font-size:12px; display:flex; justify-content:space-between; color:white; }
      .lb-options input[type="text"], .lb-options input[type="range"] { flex:1; margin-left:4px; font-family:"Poppins", sans-serif; }

      /* === Notifications === */
      .notif-wrap { position: fixed; bottom: 40px; right: 30px; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none; z-index: 999999; }
      .notif { display:flex; align-items:center; gap:8px; background: rgba(30,30,30,0.95); color:white; padding:12px 16px; margin-top:8px; border-radius:12px; font-family:"Poppins", sans-serif; font-size:13px; backdrop-filter: blur(8px); box-shadow: 0 6px 16px rgba(0,0,0,0.5); border-left:4px solid; transform: translateX(120%) translateY(20px); opacity:0; transition: transform 0.4s ease-out, opacity 0.4s ease-out; pointer-events:auto; }
      .notif.show { transform: translateX(0) translateY(0); opacity:1; }
      .notif.info { border-color:#3498db; }
      .notif.success { border-color:#2ecc71; }
      .notif.warn { border-color:#f1c40f; }
      .notif.error { border-color:#e74c3c; }

      .lb-searchwrap { position:fixed; top:15px; left:50%; transform:translateX(-50%); z-index:100001; background:#0a0a0a; border:2px solid #00aaff; padding:4px 6px; font-family:"Poppins", sans-serif; }
      .lb-search { background:#111; border:none; outline:none; color:white; font-size:13px; width:180px; font-family:"Poppins", sans-serif; }
      .lb-search::placeholder { color:#00aaff; opacity:0.6; }
      .lb-content { overflow: hidden; transition: max-height 0.3s ease; max-height:1000px; }
      .lb-content.collapsed { max-height:0; }
    `;
    document.head.appendChild(style);

    // === Notifications logic ===
    const notifWrap = document.createElement("div");
    notifWrap.className = "notif-wrap";
    document.body.appendChild(notifWrap);

    function showNotif(msg, type = "info", dur = 3000) {
      const n = document.createElement("div");
      n.className = `notif ${type}`;
      const icon = type === "info" ? "ℹ️" : type === "success" ? "✅" : type === "warn" ? "⚠️" : "❌";
      n.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
      notifWrap.appendChild(n);

      // Fade + slide in
      requestAnimationFrame(() => n.classList.add("show"));

      // Stack notifications
      const siblings = [...notifWrap.children];
      siblings.forEach((sib,i)=>{ sib.style.transform = `translateX(0) translateY(${i*8}px)`; });

      // Auto-hide with hover pause
      let hideTimeout = setTimeout(hide,dur);
      n.addEventListener("mouseenter", ()=>clearTimeout(hideTimeout));
      n.addEventListener("mouseleave", ()=>hideTimeout = setTimeout(hide,dur));

      function hide() {
        n.classList.remove("show");
        setTimeout(()=>n.remove(), 400);

        // Re-stack remaining notifications
        const remaining = [...notifWrap.children].filter(c=>c!==n);
        remaining.forEach((sib,i)=>{ sib.style.transform = `translateX(0) translateY(${i*8}px)`; });
      }
    }

    // === Persistence helpers ===
    function saveModuleState(name, mod) {
      const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
      const opts = {};
      if(mod.options) Object.entries(mod.options).forEach(([k,opt])=>{ opts[k]=opt[1]; });
      saved[name]={enabled:mod.enabled, bind:mod.bind, options:opts};
      localStorage.setItem("lb-mods",JSON.stringify(saved));
    }

    function loadModuleState(name, mod){
      const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
      if(saved[name]){
        if(saved[name].enabled !== mod.enabled && typeof mod.toggle==="function") mod.toggle();
        if(saved[name].bind) mod.setbind(saved[name].bind);
        if(saved[name].options && mod.options) Object.entries(saved[name].options).forEach(([k,v])=>{ if(mod.options[k]) mod.options[k][1]=v; });
      }
    }

    // === Panels ===
    const panels = {};
    Object.keys(categories).forEach((cat,i)=>{
      const panel = document.createElement("div");
      panel.className="lb-panel";
      panel.style.left = 40 + i*240 + "px";
      panel.style.top = "100px";

      const header = document.createElement("div");
      header.className="lb-header";

      const collapseBtn = document.createElement("span");
      collapseBtn.style.float="right"; collapseBtn.style.cursor="pointer";

      const titleSpan = document.createElement("span");
      titleSpan.textContent = `${catIcons[cat]} ${cat}`;

      header.appendChild(titleSpan);
      header.appendChild(collapseBtn);
      panel.appendChild(header);

      const saved = localStorage.getItem("lb-pos-"+cat);
      if(saved){ const {left,top} = JSON.parse(saved); panel.style.left=left; panel.style.top=top; }

      let dragging=false, offsetX, offsetY;
      header.addEventListener("mousedown",(e)=>{ dragging=true; offsetX=e.clientX-panel.offsetLeft; offsetY=e.clientY-panel.offsetTop; });
      document.addEventListener("mousemove",(e)=>{ if(dragging){ panel.style.left=e.clientX-offsetX+"px"; panel.style.top=e.clientY-offsetY+"px"; } });
      document.addEventListener("mouseup",()=>{ if(dragging){ dragging=false; localStorage.setItem("lb-pos-"+cat,JSON.stringify({left:panel.style.left,top:panel.style.top})); } });

      const contentWrap = document.createElement("div"); contentWrap.className="lb-content"; panel.appendChild(contentWrap);

      let collapsed = localStorage.getItem("lb-collapsed-"+cat) === "true";
      if(collapsed) contentWrap.classList.add("collapsed");
      collapseBtn.textContent = collapsed ? "[+]" : "[-]";
      collapseBtn.addEventListener("click",()=>{
        collapsed = !collapsed;
        contentWrap.classList.toggle("collapsed",collapsed);
        collapseBtn.textContent = collapsed ? "[+]" : "[-]";
        localStorage.setItem("lb-collapsed-"+cat,collapsed);
      });

      panels[cat]=panel;
      document.body.appendChild(panel);
    });

    // === Modules ===
    Object.entries(store.modules).forEach(([name,mod])=>{
      let cat="Utility";
      for(const [c,keys] of Object.entries(categories)) if(keys.some(k=>name.toLowerCase().includes(k))){ cat=c; break; }
      loadModuleState(name,mod);

      const row = document.createElement("div");
      row.className = "lb-module"+(mod.enabled?" active":"");
      row.innerHTML=`<span>${name}</span><span>${mod.enabled?"ON":"OFF"}</span>`;

      const optionsBox = document.createElement("div");
      optionsBox.className="lb-options";

      row.addEventListener("mousedown",(e)=>{
        if(e.button===0){ if(typeof mod.toggle==="function") mod.toggle();
        row.classList.toggle("active",mod.enabled);
        row.lastChild.textContent = mod.enabled?"ON":"OFF";
        showNotif(`${name} ${mod.enabled?"enabled":"disabled"}`,mod.enabled?"success":"error");
        saveModuleState(name,mod);
      }});

      row.addEventListener("contextmenu",(e)=>{ e.preventDefault(); optionsBox.classList.toggle("show"); });

      if(mod.options) Object.entries(mod.options).forEach(([key,opt])=>{
        const [type,val,label] = opt;
        const line=document.createElement("label");
        line.textContent = label;
        if(type===Boolean){ const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=val; cb.onchange=()=>{ opt[1]=cb.checked; saveModuleState(name,mod); }; line.appendChild(cb);}
        else if(type===Number){ const slider=document.createElement("input"); slider.type="range"; const [min,max,step]=opt.range??[0,10,0.1]; slider.min=min; slider.max=max; slider.step=step; slider.value=val; slider.oninput=()=>{ opt[1]=parseFloat(slider.value); saveModuleState(name,mod); }; line.appendChild(slider);}
        else if(type===String){ const input=document.createElement("input"); input.type="text"; input.value=val; input.onchange=()=>{ opt[1]=input.value; saveModuleState(name,mod); }; line.appendChild(input);}
        optionsBox.appendChild(line);
      });

      const bindLine=document.createElement("label");
      bindLine.textContent="Bind:";
      const bindInput=document.createElement("input");
      bindInput.type="text"; bindInput.value=mod.bind; bindInput.style.width="70px"; bindInput.style.background="#0a0a0a"; bindInput.style.color="white"; bindInput.style.border="1px solid #00aaff"; bindInput.style.fontFamily='"Poppins", sans-serif'; bindInput.style.fontSize="12px"; bindInput.style.padding="2px";
      bindInput.onchange=(e)=>{ mod.setbind(e.target.value); showNotif(`${name} bind set to ${e.target.value}`,"info"); saveModuleState(name,mod); };
      bindLine.appendChild(bindInput); optionsBox.appendChild(bindLine);

      panels[cat].querySelector(".lb-content").appendChild(row);
      panels[cat].querySelector(".lb-content").appendChild(optionsBox);
    });

    // === Reset / Config buttons ===
    const resetRow = document.createElement("div"); resetRow.className="lb-module"; resetRow.style.color="#00aaff"; resetRow.textContent="↺ Reset Layout";
    resetRow.addEventListener("click",()=>{
      const defaults={ Combat:{left:"40px",top:"100px"}, Movement:{left:"280px",top:"100px"}, "Player / Render":{left:"520px",top:"100px"}, World:{left:"760px",top:"100px"}, Utility:{left:"1000px",top:"100px"} };
      Object.entries(defaults).forEach(([cat,pos])=>{ localStorage.setItem("lb-pos-"+cat,JSON.stringify(pos)); if(panels[cat]){ panels[cat].style.left=pos.left; panels[cat].style.top=pos.top; } });
      showNotif("Layout reset to default","success");
    });
    panels["Utility"].querySelector(".lb-content").appendChild(resetRow);

    const resetConfigRow = document.createElement("div"); resetConfigRow.className="lb-module"; resetConfigRow.style.color="red"; resetConfigRow.textContent="⛔ Reset Config";
    resetConfigRow.addEventListener("click",()=>{
      localStorage.removeItem("lb-mods");
      Object.keys(localStorage).filter(k=>k.startsWith("lb-pos-")).forEach(k=>localStorage.removeItem(k));
      Object.keys(localStorage).filter(k=>k.startsWith("lb-collapsed-")).forEach(k=>localStorage.removeItem(k));
      alert("Config has been reset!"); location.reload();
    });
    panels["Utility"].querySelector(".lb-content").appendChild(resetConfigRow);

    // === Search ===
    const searchWrap = document.createElement("div"); searchWrap.className="lb-searchwrap"; searchWrap.innerHTML=`<input type="text" class="lb-search" placeholder="Search...">`;
    document.body.appendChild(searchWrap);
    const searchBox = searchWrap.querySelector("input");
    searchBox.addEventListener("input",()=>{
      const term=searchBox.value.toLowerCase();
      document.querySelectorAll(".lb-module").forEach(row=>{ const name=row.firstChild.textContent.toLowerCase(); row.style.display=name.includes(term)?"flex":"none"; });
    });

    // === Hide on load ===
    Object.values(panels).forEach(p=>p.style.display="none"); searchWrap.style.display="none";

    // === Startup notification ===
    setTimeout(()=>{ showNotif("[ClickGUI@v5.6 Loaded!] Press \\\\ to open ClickGUI! Enjoy!","info",4000); },500);

    // === Toggle GUI ===
    let visible=false;
    document.addEventListener("keydown",(e)=>{ if(e.code==="Backslash"){ e.preventDefault(); visible=!visible; Object.values(panels).forEach(p=>p.style.display=visible?"block":"none"); searchWrap.style.display=visible?"block":"none"; } });
  }
})();
