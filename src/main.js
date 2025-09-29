/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "5.8";

// ANTICHEAT HOOK
function replaceAndCopyFunction(oldFunc, newFunc) {
	return new Proxy(oldFunc, {
		apply(orig, origIden, origArgs) {
			const result = orig.apply(origIden, origArgs);
			newFunc(result);
			return result;
		},
		get(orig) {
			return orig;
		}
	});
}

Object.getOwnPropertyNames = replaceAndCopyFunction(Object.getOwnPropertyNames, function(list) {
	if (list.indexOf(storeName) != -1) list.splice(list.indexOf(storeName), 1);
	return list;
});
Object.getOwnPropertyDescriptors = replaceAndCopyFunction(Object.getOwnPropertyDescriptors, function(list) {
	delete list[storeName];
	return list;
});

/**
 *
 * @param {string} replacement
 * @param {string} code
 * @param {boolean} replace
 */
function addModification(replacement, code, replace) {
	replacements[replacement] = [code, replace];
}

function addDump(replacement, code) {
	dumpedVarNames[replacement] = code;
}

/**
 *
 * @param {string} text
 */
function modifyCode(text) {
	let modifiedText = text;
	for(const [name, regex] of Object.entries(dumpedVarNames)) {
		const matched = modifiedText.match(regex);
		if (matched) {
			for(const [replacement, code] of Object.entries(replacements)){
				delete replacements[replacement];
				replacements[replacement.replaceAll(name, matched[1])] = [code[0].replaceAll(name, matched[1]), code[1]];
			}
		}
	}
	const unmatchedDumps = Object.entries(dumpedVarNames).filter(e => !modifiedText.match(e[1]));
	if (unmatchedDumps.length > 0) console.warn("Unmatched dumps:", unmatchedDumps);

	const unmatchedReplacements = Object.entries(replacements).filter(r => modifiedText.replace(r[0]) === text);
	if (unmatchedReplacements.length > 0) console.warn("Unmatched replacements:", unmatchedReplacements);

	for(const [replacement, code] of Object.entries(replacements)) {
		modifiedText = modifiedText.replace(replacement, code[1] ? code[0] : replacement + code[0]);

	}

	const newScript = document.createElement("script");
	newScript.type = "module";
	newScript.crossOrigin = "";
	newScript.textContent = modifiedText;
	const head = document.querySelector("head");
	head.appendChild(newScript);
	newScript.textContent = "";
	newScript.remove();
}

(function() {
	'use strict';

	// DUMPING
	addDump('moveStrafeDump', 'this\\.([a-zA-Z]+)=\\([a-zA-Z]+\\.right');
	addDump('moveForwardDump', 'this\\.([a-zA-Z]+)=\\([a-zA-Z]+\\.(up|down)');
	addDump('keyPressedDump', 'function ([a-zA-Z]*)\\([a-zA-Z]*\\)\{return keyPressed\\([a-zA-Z]*\\)');
	addDump('entitiesDump', 'this\.([a-zA-Z]*)\.values\\(\\)\\)[a-zA-Z]* instanceof EntityTNTPrimed');
	addDump('isInvisibleDump', '[a-zA-Z]*\.([a-zA-Z]*)\\(\\)\\)&&\\([a-zA-Z]*=new ([a-zA-Z]*)\\(new');
	addDump('attackDump', 'hitVec.z\}\\)\}\\)\\),player\.([a-zA-Z]*)');
	addDump('lastReportedYawDump', 'this\.([a-zA-Z]*)=this\.yaw,this\.last');
	addDump('windowClickDump', '([a-zA-Z]*)\\(this\.inventorySlots\.windowId');
	addDump('playerControllerDump', 'const ([a-zA-Z]*)=new PlayerController,');
	addDump('damageReduceAmountDump', 'ItemArmor&&\\([a-zA-Z]*\\+\\=[a-zA-Z]*\.([a-zA-Z]*)');
	addDump('boxGeometryDump', 'w=new Mesh\\(new ([a-zA-Z]*)\\(1');
	addDump('syncItemDump', 'playerControllerMP\.([a-zA-Z]*)\\(\\),ClientSocket\.sendPacket');

	// PRE
	addModification('document.addEventListener("DOMContentLoaded",startGame,!1);', `
		setTimeout(function() {
			var DOMContentLoaded_event = document.createEvent("Event");
			DOMContentLoaded_event.initEvent("DOMContentLoaded", true, true);
			document.dispatchEvent(DOMContentLoaded_event);
		}, 0);
	`);
	addModification('y:this.getEntityBoundingBox().min.y,', 'y:sendY != false ? sendY : this.getEntityBoundingBox().min.y,', true);
	addModification("const player=new ClientEntityPlayer", `
// note: when using the desync,
// your position will only update every 20 ticks.
let serverPos = player.pos.clone();
`);
	addModification('Potions.jump.getId(),"5");', `
		let blocking = false;
		let sendYaw = false;
		let sendY = false;
        let desync = false;
		let breakStart = Date.now();
		let noMove = Date.now();

		let enabledModules = {};
		let modules = {};

		let keybindCallbacks = {};
		let keybindList = {};

		let tickLoop = {};
		let renderTickLoop = {};
  
  /**
		 * clamps the given position to the given range
		 * @param {Vector3} pos
		 * @param {Vector3} serverPos
		 * @param {number} range
		 * @returns {Vector3} the clamped position
		**/
		function desyncMath(pos, serverPos, range) {
			const moveVec = {x: (pos.x - serverPos.x), y: (pos.y - serverPos.y), z: (pos.z - serverPos.z)};
			const moveMag = Math.sqrt(moveVec.x * moveVec.x + moveVec.y * moveVec.y + moveVec.z * moveVec.z);

			return moveMag > range ? {
				x: serverPos.x + ((moveVec.x / moveMag) * range),
				y: serverPos.y + ((moveVec.y / moveMag) * range),
				z: serverPos.z + ((moveVec.z / moveMag) * range)
			} : pos;
		}

		let lastJoined, velocityhori, velocityvert, chatdisablermsg, textguifont, textguisize, textguishadow, attackedEntity, stepheight;
		let attackTime = Date.now();
		let chatDelay = Date.now();

		function getModule(str) {
			for(const [name, module] of Object.entries(modules)) {
				if (name.toLocaleLowerCase() == str.toLocaleLowerCase()) return module;
			}
		}

		let j;
		for (j = 0; j < 26; j++) keybindList[j + 65] = keybindList["Key" + String.fromCharCode(j + 65)] = String.fromCharCode(j + 97);
		for (j = 0; j < 10; j++) keybindList[48 + j] = keybindList["Digit" + j] = "" + j;
		window.addEventListener("keydown", function(key) {
			const func = keybindCallbacks[keybindList[key.code]];
			if (func) func(key);
		});
	`);

	addModification('VERSION$1," | ",', `"${vapeName} v${VERSION}"," | ",`);
	addModification('if(!x.canConnect){', 'x.errorMessage = x.errorMessage === "Could not join server. You are connected to a VPN or proxy. Please disconnect from it and refresh this page." ? "You\'re possibly IP banned or you\'re using a VPN " : x.errorMessage;');

	// DRAWING SETUP
	addModification('I(this,"glintTexture");', `
		I(this, "vapeTexture");
	`);
	/**
	 * @param {string} url
	 * @returns
	 */
	const corsMoment = url => {
		return new URL(`https://corsproxy.io/?url=${url}`).href;
	}
	addModification('skinManager.loadTextures(),', ',this.loadVape(),');
	addModification('async loadSpritesheet(){', `
		async loadVape() {
			this.vapeTexture = await this.loader.loadAsync("${corsMoment("https://raw.githubusercontent.com/ProgMEM-CC/miniblox.impact.client.updatedv2/refs/heads/main/Logo.png")}");
		}
		async loadSpritesheet(){
	`, true);

	// TELEPORT FIX
	addModification('player.setPositionAndRotation(h.x,h.y,h.z,h.yaw,h.pitch),', `
		noMove = Date.now() + 500;
		player.setPositionAndRotation(h.x,h.y,h.z,h.yaw,h.pitch),
	`, true);

	addModification('COLOR_TOOLTIP_BG,BORDER_SIZE)}', `
    function drawImage(ctx, img, posX, posY, sizeX, sizeY, color) {
        if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(posX, posY, sizeX, sizeY);
            ctx.globalCompositeOperation = "destination-in";
        }
        ctx.drawImage(img, posX, posY, sizeX, sizeY);
        if (color) ctx.globalCompositeOperation = "source-over";
    }
`);
// TextGUI (Created by ModuleMaster64)
addModification(
  '(this.drawSelectedItemStack(),this.drawHintBox())',
  /*js*/`
    if (ctx$5 && enabledModules["TextGUI"]) {
        const colorOffset = Date.now() / 4000;

        const canvasW = ctx$5.canvas.width;
        const canvasH = ctx$5.canvas.height;

        ctx$5.imageSmoothingEnabled = true;
        ctx$5.imageSmoothingQuality = "high";

  // === Mode store if there any more please add to here! ===
  const moduleModes = {
  autofunnychat: "Meme",
  AutoRespawn: "Instant",
  ChatDisabler: "Packets",
  NoSlowdown: "Vanilla",
  FilterBypass: "Unicode",
  NameTags: "Custom",
  AutoClicker: "RMB",
  AutoQueue: "Instant",
  ChestSteal: "Hypixel",
  KeepSprint: "All",
  InvCleaner: "Normal",
  AutoArmor: "Smart",
  AutoRejoin: "Delay",
  LongJump: "Vanilla",
  AntiCheat: "Bypass",
  FastBreak: "Instant",
  AutoCraft: "Sword",
  AutoVote: "SkyWars",
  MusicFix: "Auto",
  Scaffold: "MultiBlock",
  Velocity: "Basic",
  InvWalk: "Normal",
  AntiBan: "Packet",
  Breaker: "Egg",
  Killaura: "Single",
  AntiFall: "Packet",
  Speed: "JumpSpeed",
  NoFall: "Desync",
  Phase: "Normal",
  Sprint: "Normal",
  Jesus: "Vanilla",
  Timer: "Boost",
  WTap: "Legit",
  Step: "Vanilla",
  ESP: "Box",
  Fly: "Desync",
  ChinaHat: "FunnyWarz",
  };

        // Draw logo (bottom-right)
        const logo = textureManager.vapeTexture.image;
        const scale = 0.9;
        const logoW = logo.width * scale;
        const logoH = logo.height * scale;
        const posX = canvasW - logoW - 15;
        const posY = canvasH - logoH - 15;

        ctx$5.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx$5.shadowBlur = 6;
        drawImage(ctx$5, logo, posX, posY, logoW, logoH);
        ctx$5.shadowColor = "transparent";
        ctx$5.shadowBlur = 0;

        let offset = 0;
        const stringList = [];

        for (const [module, value] of Object.entries(enabledModules)) {
            if (!value || module === "TextGUI") continue;
            stringList.push(module);
        }

        // Sort by width (desc)
        stringList.sort(
          (a, b) => ctx$5.measureText(b).width - ctx$5.measureText(a).width
        );

        // Draw modules on the right
        const paddingRight = 15;
        const startY = 27 + 10;

        for (const moduleName of stringList) {
            offset++;

            const fontStyle = \`\${textguisize[1]}px \${textguifont[1]}\`;
            ctx$5.font = fontStyle;

            // Build strings
            const rainbowText = moduleName;
            const modeText = moduleModes[moduleName] ? " - " + moduleModes[moduleName] : "";

            const fullText = rainbowText + modeText;
            const textWidth = ctx$5.measureText(fullText).width;
            const x = canvasW - textWidth - paddingRight;
            const y = startY + (textguisize[1] + 3) * offset;

            // Shadow for both parts
            ctx$5.shadowColor = "black";
            ctx$5.shadowBlur = 4;
            ctx$5.shadowOffsetX = 1;
            ctx$5.shadowOffsetY = 1;

            // Draw rainbow part
            drawText(
                ctx$5,
                rainbowText,
                x,
                y,
                fontStyle,
                \`hsl(\${((colorOffset - 0.025 * offset) % 1) * 360},100%,50%)\`,
                "left",
                "top",
                1,
                textguishadow[1]
            );

            // Draw grey mode part (after rainbow width)
            if (modeText) {
                const rainbowWidth = ctx$5.measureText(rainbowText).width;
                drawText(
                    ctx$5,
                    modeText,
                    x + rainbowWidth,
                    y,
                    fontStyle,
                    "#bbbbbb",
                    "left",
                    "top",
                    1,
                    textguishadow[1]
                );
            }

            // Reset shadow
            ctx$5.shadowColor = "transparent";
            ctx$5.shadowBlur = 0;
            ctx$5.shadowOffsetX = 0;
            ctx$5.shadowOffsetY = 0;
        }
    }
`
);
	addModification('+=h*y+u*x}', `
		if (this == player) {
			for(const [index, func] of Object.entries(tickLoop)) if (func) func();
		}
	`);
	addModification('this.game.unleash.isEnabled("disable-ads")', 'true', true);
	addModification('h.render()})', '; for(const [index, func] of Object.entries(renderTickLoop)) if (func) func();');
	addModification('updateNameTag(){let h="white",p=1;', 'this.entity.team = this.entity.profile.cosmetics.color;');
	addModification('connect(u,h=!1,p=!1){', 'lastJoined = u;');
	addModification('SliderOption("Render Distance ",2,8,3)', 'SliderOption("Render Distance ",2,64,3)', true);
	addModification('ClientSocket.on("CPacketDisconnect",h=>{', `
		if (enabledModules["AutoRejoin"]) {
			setTimeout(function() {
				j.connect(lastJoined);
			}, 400);
		}
	`);

	addModification('ClientSocket.on("CPacketMessage",h=>{', `
		if (player && h.text && !h.text.startsWith(player.name) && enabledModules["ChatDisabler"] && chatDelay < Date.now()) {
			chatDelay = Date.now() + 1000;
			setTimeout(function() {
				ClientSocket.sendPacket(new SPacketMessage({text: Math.random() + ("\\n" + chatdisablermsg[1]).repeat(20)}));
			}, 50);
		}

		if (h.text && h.text.startsWith("\\\\bold\\\\How to play:")) {
			breakStart = Date.now() + 25000;
		}

		if (h.text && h.text.indexOf("Poll started") != -1 && h.id == undefined && enabledModules["AutoVote"]) {
			ClientSocket.sendPacket(new SPacketMessage({text: "/vote 2"}));
		}

		if (h.text && h.text.indexOf("won the game") != -1 && h.id == undefined && enabledModules["AutoQueue"]) {
			game.requestQueue();
		}
	`);
	addModification('ClientSocket.on("CPacketUpdateStatus",h=>{', `
		if (h.rank && h.rank != "" && RANK.LEVEL[$.rank].permLevel > 2) {
			game.chat.addChat({
				text: "STAFF DETECTED : " + h.rank + "\\n".repeat(10),
				color: "red"
			});
		}
	`);

	// REBIND
	addModification('bindKeysWithDefaults("b",m=>{', 'bindKeysWithDefaults("semicolon",m=>{', true);
	addModification('bindKeysWithDefaults("i",m=>{', 'bindKeysWithDefaults("apostrophe",m=>{', true);

	// SPRINT
	addModification('b=keyPressedDump("shift")||touchcontrols.sprinting', '||enabledModules["Sprint"]');

	// VELOCITY
	addModification('"CPacketEntityVelocity",h=>{const p=m.world.entitiesDump.get(h.id);', `
		if (player && h.id == player.id && enabledModules["Velocity"]) {
			if (velocityhori[1] == 0 && velocityvert[1] == 0) return;
			h.motion = new Vector3$1($.motion.x * velocityhori[1], h.motion.y * velocityvert[1], h.motion.z * velocityhori[1]);
		}
	`);
	addModification('"CPacketExplosion",h=>{', `
		if (h.playerPos && enabledModules["Velocity"]) {
			if (velocityhori[1] == 0 && velocityvert[1] == 0) return;
			h.playerPos = new Vector3$1(h.playerPos.x * velocityhori[1], h.playerPos.y * velocityvert[1], h.playerPos.z * velocityhori[1]);
		}
	`);

	// KEEPSPRINT
	addModification('g>0&&(h.addVelocity(-Math.sin(this.yaw*Math.PI/180)*g*.5,.1,Math.cos(this.yaw*Math.PI/180)*g*.5),this.motion.x*=.6,this.motion.z*=.6)', `
		if (g > 0) {
h.addVelocity(-Math.sin(this.yaw) * g * .5, .1, -Math.cos(this.yaw) * g * .5);
			if (this != player || !enabledModules["KeepSprint"]) {
				this.motion.x *= .6;
				this.motion.z *= .6;
				this.setSprinting(!1);
			}
		}
	`, true);

	// KILLAURA
	addModification('else player.isBlocking()?', 'else (player.isBlocking() || blocking)?', true);
	addModification('this.entity.isBlocking()', '(this.entity.isBlocking() || this.entity == player && blocking)', true);
	addModification('this.yaw-this.', '(sendYaw || this.yaw)-this.', true);
	addModification("x.yaw=player.yaw", 'x.yaw=(sendYaw || this.yaw)', true);
	addModification('this.lastReportedYawDump=this.yaw,', 'this.lastReportedYawDump=(sendYaw || this.yaw),', true);
	addModification('this.neck.rotation.y=controls.yaw', 'this.neck.rotation.y=(sendYaw||controls.yaw)', true);

	// NOSLOWDOWN
	addModification('updatePlayerMoveState(),this.isUsingItem()', 'updatePlayerMoveState(),(this.isUsingItem() && !enabledModules["NoSlowdown"])', true);
	addModification('S&&!this.isUsingItem()', 'S&&!(this.isUsingItem() && !enabledModules["NoSlowdown"])', true);

	 // DESYNC
	addModification("this.inputSequenceNumber++", 'desync ? this.inputSequenceNumber : this.inputSequenceNumber++', true);
	// addModification("new PBVector3({x:this.pos.x,y:this.pos.y,z:this.pos.z})", "desync ? inputPos : inputPos = this.pos", true);

	// auto-reset the desync variable.
	addModification("reconcileServerPosition(h){", "serverPos = h;");

	// hook into the reconcileServerPosition
	// so we know our server pos

	// STEP
	addModification('p.y=this.stepHeight;', 'p.y=(enabledModules["Step"]?Math.max(stepheight[1],this.stepHeight):this.stepHeight);', true);

	// WTAP
	addModification('this.dead||this.getHealth()<=0)return;', `
		if (enabledModules["WTap"]) player.serverSprintState = false;
	`);

	// FASTBREAK
	addModification('u&&player.mode.isCreative()', `||enabledModules["FastBreak"]`);

	// INVWALK
	addModification('keyPressed(m)&&Game.isActive(!1)', 'keyPressed(m)&&(Game.isActive(!1)||enabledModules["InvWalk"]&&!game.chat.showInput)', true);

	// PHASE
	addModification('calculateXOffset(A,this.getEntityBoundingBox(),g.x)', 'enabledModules["Phase"] ? g.x : calculateXOffset(A,this.getEntityBoundingBox(),g.x)', true);
	addModification('calculateYOffset(A,this.getEntityBoundingBox(),g.y)', 'enabledModules["Phase"] && !enabledModules["Scaffold"] && keyPressedDump("shift") ? g.y : calculateYOffset(A,this.getEntityBoundingBox(),g.y)', true);
	addModification('calculateZOffset(A,this.getEntityBoundingBox(),g.z)', 'enabledModules["Phase"] ? g.z : calculateZOffset(A,this.getEntityBoundingBox(),g.z)', true);
	addModification('pushOutOfBlocks(u,h,p){', 'if (enabledModules["Phase"]) return;');

	// AUTORESPAWN
	addModification('this.game.info.showSignEditor=null,exitPointerLock())', `
		if (this.showDeathScreen && enabledModules["AutoRespawn"]) {
			ClientSocket.sendPacket(new SPacketRespawn$1);
		}
	`);

	// PLAYER ESP (created by ModuleMaster64 :D)
	addModification(')&&(p.mesh.visible=this.shouldRenderEntity(p))', `
  if (p && p.id != player.id) {
    function hslToRgb(h, s, l) {
      let r, g, b;
      if(s === 0){ r = g = b = l; }
      else {
        const hue2rgb = (p, q, t) => {
          if(t < 0) t += 1;
          if(t > 1) t -= 1;
          if(t < 1/6) return p + (q - p) * 6 * t;
          if(t < 1/2) return q;
          if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const pp = 2 * l - q;
        r = hue2rgb(pp, q, h + 1/3);
        g = hue2rgb(pp, q, h);
        b = hue2rgb(pp, q, h - 1/3);
      }
      return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
      };
    }

    function applyOutlineGlow(mesh, colorHex) {
      if (!mesh || !mesh.material) return;
      if (!mesh.userData.outlineClone) {
        const outlineMaterial = mesh.material.clone();
        outlineMaterial.color.setHex(0x000000);
        outlineMaterial.emissive.setHex(colorHex);
        outlineMaterial.emissiveIntensity = 1;
        outlineMaterial.transparent = true;
        outlineMaterial.opacity = 0.7;
        outlineMaterial.depthTest = false;

        const outline = mesh.clone();
        outline.material = outlineMaterial;
        outline.scale.multiplyScalar(1.05);
        outline.renderOrder = mesh.renderOrder + 1;

        mesh.add(outline);
        mesh.userData.outlineClone = outline;
      } else {
        mesh.userData.outlineClone.material.emissive.setHex(colorHex);
      }
    }

    if (enabledModules["ESP"]) {
      const time = Date.now() / 5000;
      const hue = time % 1;
      const rgb = hslToRgb(hue, 1, 0.5);
      const colorHex = (rgb.r << 16) + (rgb.g << 8) + rgb.b;

      if (p.mesh.meshes) {
        for (const key in p.mesh.meshes) {
          const mesh = p.mesh.meshes[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 3;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }

      if (p.mesh.armorMesh) {
        for (const key in p.mesh.armorMesh) {
          const mesh = p.mesh.armorMesh[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 4;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }

      if (p.mesh.capeMesh && p.mesh.capeMesh.children.length > 0) {
        const cape = p.mesh.capeMesh.children[0];
        if (cape.material) {
          cape.material.depthTest = false;
          cape.renderOrder = 5;
          cape.material.color.setHex(colorHex);
          cape.material.emissive.setHex(colorHex);
          cape.material.emissiveIntensity = 0.8;
          applyOutlineGlow(cape, colorHex);
        }
      }

      if (p.mesh.hatMesh && p.mesh.hatMesh.children.length > 0) {
        for (const mesh of p.mesh.hatMesh.children[0].children) {
          if (!mesh.material) continue;
          mesh.material.depthTest = false;
          mesh.renderOrder = 4;
          mesh.material.color.setHex(colorHex);
          mesh.material.emissive.setHex(colorHex);
          mesh.material.emissiveIntensity = 0.8;
          applyOutlineGlow(mesh, colorHex);
        }
      }
    } else {
      if (p.mesh.meshes) {
        for (const key in p.mesh.meshes) {
          const mesh = p.mesh.meshes[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }

      if (p.mesh.armorMesh) {
        for (const key in p.mesh.armorMesh) {
          const mesh = p.mesh.armorMesh[key];
          if (!mesh?.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }

      if (p.mesh.capeMesh && p.mesh.capeMesh.children.length > 0) {
        const cape = p.mesh.capeMesh.children[0];
        if (cape.material) {
          cape.material.depthTest = true;
          cape.renderOrder = 0;
          cape.material.color.setHex(0xffffff);
          cape.material.emissive.setHex(0x000000);
          cape.material.emissiveIntensity = 0;
        }
        if (cape.userData.outlineClone) {
          cape.remove(cape.userData.outlineClone);
          cape.userData.outlineClone = null;
        }
      }

      if (p.mesh.hatMesh && p.mesh.hatMesh.children.length > 0) {
        for (const mesh of p.mesh.hatMesh.children[0].children) {
          if (!mesh.material) continue;
          mesh.material.depthTest = true;
          mesh.renderOrder = 0;
          mesh.material.color.setHex(0xffffff);
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          if (mesh.userData.outlineClone) {
            mesh.remove(mesh.userData.outlineClone);
            mesh.userData.outlineClone = null;
          }
        }
      }
    }
  }
`);
    // ChinaHat Module!
    addModification(')&&(p.mesh.visible=this.shouldRenderEntity(p))', `
  if (enabledModules["ChinaHat"] && p && p.id != player.id && p instanceof EntityPlayer) {
    // Only apply ChinaHat to players (not items, mobs, etc.)
    if (!p.mesh.userData.chinaHat) {
      const brim = new Mesh(new boxGeometryDump(1, 1, 1));
      brim.material.depthTest = false;
      brim.material.transparent = true;
      brim.material.opacity = 0.8;
      brim.renderOrder = 6;

      const cap = new Mesh(new boxGeometryDump(1, 1, 1));
      cap.material.depthTest = false;
      cap.material.transparent = true;
      cap.material.opacity = 0.8;
      cap.renderOrder = 7;

      p.mesh.add(brim);
      p.mesh.add(cap);

      p.mesh.userData.chinaHat = { brim, cap };
    }

    const { brim, cap } = p.mesh.userData.chinaHat;

    // Animate rainbow color
    const time = Date.now() / 2000;
    const hue = (time % 1);
    const rgb = hslToRgb(hue, 1, 0.5);

    brim.material.color.set(rgb.r, rgb.g, rgb.b);
    cap.material.color.set(rgb.r, rgb.g, rgb.b);

    // Position + scale
    brim.position.set(0, 2.2, 0);
    brim.scale.set(1.8, 0.05, 1.8); // brim disc

    cap.position.set(0, 2.35, 0);
    cap.scale.set(0.7, 0.2, 0.7);   // cap block
  } else if (p?.mesh?.userData?.chinaHat) {
    // Cleanup when disabled
    const { brim, cap } = p.mesh.userData.chinaHat;
    p.mesh.remove(brim);
    p.mesh.remove(cap);
    delete p.mesh.userData.chinaHat;
  }

  // === helper ===
  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const pp = 2 * l - q;
      r = hue2rgb(pp, q, h + 1/3);
      g = hue2rgb(pp, q, h);
      b = hue2rgb(pp, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }
`);

	// LOGIN BYPASS (cleaned up)
    addModification(
  'new SPacketLoginStart({ ' +
    'requestedUuid: localStorage.getItem(REQUESTED_UUID_KEY) ?? void 0, ' +
    'session: localStorage.getItem(SESSION_TOKEN_KEY) ?? "", ' +
    'hydration: localStorage.getItem("hydration") ?? "0", ' +
    'metricsId: localStorage.getItem("metrics_id") ?? "", ' +
    'clientVersion: VERSION$1 ' +
  '})',
  'new SPacketLoginStart({ ' +
    'requestedUuid: void 0, ' +
    'session: enabledModules["AntiBan"] ? "" : (localStorage.getItem(SESSION_TOKEN_KEY) ?? ""), ' +
    'hydration: "0", ' +
    'metricsId: uuid$1(), ' +
    'clientVersion: VERSION$1 ' +
  '})',
  true
);
	// KEY FIX
	addModification('Object.assign(keyMap,u)', '; keyMap["Semicolon"] = "semicolon"; keyMap["Apostrophe"] = "apostrophe";');

	// SWING FIX
	addModification('player.getActiveItemStack().item instanceof', 'null == ', true);

	// COMMANDS
	addModification('submit(u){', `
		const str = this.inputValue.toLocaleLowerCase();
		const args = str.split(" ");
		let chatString;
		switch (args[0]) {
			case ".bind": {
				const module = args.length > 2 && getModule(args[1]);
				if (module) module.setbind(args[2] == "none" ? "" : args[2], true);
				return this.closeInput();
			}
			case ".t":
			case ".toggle":
				if (args.length > 1) {
					const module = args.length > 1 && getModule(args[1]);
					if (module) {
						module.toggle();
						game.chat.addChat({
							text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
							color: module.enabled ? "lime" : "red"
						});
					}
					else if (args[1] == "all") {
						for(const [name, module] of Object.entries(modules)) module.toggle();
					}
				}
				return this.closeInput();
			case ".modules":
				chatString = "Module List\\n";
				for(const [name, module] of Object.entries(modules)) chatString += "\\n" + name;
				game.chat.addChat({text: chatString});
				return this.closeInput();
			case ".binds":
				chatString = "Bind List\\n";
				for(const [name, module] of Object.entries(modules)) chatString += "\\n" + name + " : " + (module.bind != "" ? module.bind : "none");
				game.chat.addChat({text: chatString});
				return this.closeInput();
			case ".setoption":
			case ".reset": {
				const module = args.length > 1 && getModule(args[1]);
				const reset = args[0] == ".reset";
				if (module) {
					if (args.length < 3) {
						chatString = module.name + " Options";
						for(const [name, value] of Object.entries(module.options)) chatString += "\\n" + name + " : " + value[0].name + " : " + value[1];
						game.chat.addChat({text: chatString});
						return this.closeInput();
					}

					let option;
					for(const [name, value] of Object.entries(module.options)) {
						if (name.toLocaleLowerCase() == args[2].toLocaleLowerCase()) option = value;
					}
					if (!option) return;
					// the last value is the default value.
					// ! don't change the default value (the last option), otherwise .reset won't work properly!
					if (reset) {
						option[1] = option[option.length - 1];
						game.chat.addChat({text: "Reset " + module.name + " " + option[2] + " to " + option[1]});
						return this.closeInput();
					}
					if (option[0] == Number) option[1] = !isNaN(Number.parseFloat(args[3])) ? Number.parseFloat(args[3]) : option[1];
					else if (option[0] == Boolean) option[1] = args[3] == "true";
					else if (option[0] == String) option[1] = args.slice(3).join(" ");
					game.chat.addChat({text: "Set " + module.name + " " + option[2] + " to " + option[1]});
				}
				return this.closeInput();
			}
			case ".config":
			case ".profile":
				if (args.length > 1) {
					switch (args[1]) {
						case "save":
							globalThis.${storeName}.saveVapeConfig(args[2]);
							game.chat.addChat({text: "Saved config " + args[2]});
							break;
						case "load":
							globalThis.${storeName}.saveVapeConfig();
							globalThis.${storeName}.loadVapeConfig(args[2]);
							game.chat.addChat({text: "Loaded config " + args[2]});
							break;
						case "import":
							globalThis.${storeName}.importVapeConfig(args[2]);
							game.chat.addChat({text: "Imported config"});
							break;
						case "export":
							globalThis.${storeName}.exportVapeConfig();
							game.chat.addChat({text: "Config set to clipboard!"});
							break;
					}
				}
				return this.closeInput();
		}
		if (enabledModules["FilterBypass"] && !this.isInputCommandMode) {
			const words = this.inputValue.split(" ");
			let newwords = [];
			for(const word of words) newwords.push(word.charAt(0) + '\\\\' + word.slice(1));
			this.inputValue = newwords.join(' ');
		}
	`);

	// CONTAINER FIX 
	addModification(
		'const m=player.openContainer',
		`const m = player.openContainer ?? { getLowerChestInventory: () => {getSizeInventory: () => 0} }`,
		true
		);

	// MAIN
	addModification('document.addEventListener("contextmenu",m=>m.preventDefault());', /*js*/`
		// my code lol!
		(function() {
			class Module {
				constructor(name, func) {
					this.name = name;
					this.func = func;
					this.enabled = false;
					this.bind = "";
					this.options = {};
					modules[this.name] = this;
				}
				toggle() {
					this.enabled = !this.enabled;
					enabledModules[this.name] = this.enabled;
					this.func(this.enabled);
				}
				setbind(key, manual) {
					if (this.bind != "") delete keybindCallbacks[this.bind];
					this.bind = key;
					if (manual) game.chat.addChat({text: "Bound " + this.name + " to " + (key == "" ? "none" : key) + "!"});
					if (key == "") return;
					const module = this;
					keybindCallbacks[this.bind] = function(j) {
						if (Game.isActive()) {
							module.toggle();
							game.chat.addChat({
								text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
								color: module.enabled ? "lime" : "red"
							});
						}
					};
				}
				addoption(name, typee, defaultt) {
					this.options[name] = [typee, defaultt, name, defaultt];
					return this.options[name];
				}
			}
				
			//<MODULES_HERE>

			globalThis.${storeName}.modules = modules;
			globalThis.${storeName}.profile = "default";
		})();
	`);

	async function saveVapeConfig(profile) {
		if (!loadedConfig) return;
		let saveList = {};
		for(const [name, module] of Object.entries(unsafeWindow.globalThis[storeName].modules)) {
			saveList[name] = {enabled: module.enabled, bind: module.bind, options: {}};
			for(const [option, setting] of Object.entries(module.options)) {
				saveList[name].options[option] = setting[1];
			}
		}
		GM_setValue("vapeConfig" + (profile ?? unsafeWindow.globalThis[storeName].profile), JSON.stringify(saveList));
		GM_setValue("mainVapeConfig", JSON.stringify({profile: unsafeWindow.globalThis[storeName].profile}));
	};

	async function loadVapeConfig(switched) {
		loadedConfig = false;
		const loadedMain = JSON.parse(await GM_getValue("mainVapeConfig", "{}")) ?? {profile: "default"};
		unsafeWindow.globalThis[storeName].profile = switched ?? loadedMain.profile;
		const loaded = JSON.parse(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
		if (!loaded) {
			loadedConfig = true;
			return;
		}

		for(const [name, module] of Object.entries(loaded)) {
			const realModule = unsafeWindow.globalThis[storeName].modules[name];
			if (!realModule) continue;
			if (realModule.enabled != module.enabled) realModule.toggle();
			if (realModule.bind != module.bind) realModule.setbind(module.bind);
			if (module.options) {
				for(const [option, setting] of Object.entries(module.options)) {
					const realOption = realModule.options[option];
					if (!realOption) continue;
					realOption[1] = setting;
				}
			}
		}
		loadedConfig = true;
	};

	async function exportVapeConfig() {
		navigator.clipboard.writeText(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
	};

	async function importVapeConfig() {
		const arg = await navigator.clipboard.readText();
		if (!arg) return;
		GM_setValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, arg);
		loadVapeConfig();
	};

	let loadedConfig = false;
	async function execute(src, oldScript) {
		Object.defineProperty(unsafeWindow.globalThis, storeName, {value: {}, enumerable: false});
		if (oldScript) oldScript.type = 'javascript/blocked';
		await fetch(src).then(e => e.text()).then(e => modifyCode(e));
		if (oldScript) oldScript.type = 'module';
		await new Promise((resolve) => {
			const loop = setInterval(async function() {
				if (unsafeWindow.globalThis[storeName].modules) {
					clearInterval(loop);
					resolve();
				}
			}, 10);
		});
		unsafeWindow.globalThis[storeName].saveVapeConfig = saveVapeConfig;
		unsafeWindow.globalThis[storeName].loadVapeConfig = loadVapeConfig;
		unsafeWindow.globalThis[storeName].exportVapeConfig = exportVapeConfig;
		unsafeWindow.globalThis[storeName].importVapeConfig = importVapeConfig;
		loadVapeConfig();
		setInterval(async function() {
			saveVapeConfig();
		}, 10000);
	}

	const publicUrl = "scripturl";
	// https://stackoverflow.com/questions/22141205/intercept-and-alter-a-sites-javascript-using-greasemonkey
	if (publicUrl == "scripturl") {
		if (navigator.userAgent.indexOf("Firefox") != -1) {
			window.addEventListener("beforescriptexecute", function(e) {
				if (e.target.src.includes("https://miniblox.io/assets/index")) {
					e.preventDefault();
					e.stopPropagation();
					execute(e.target.src);
				}
			}, false);
		}
		else {
			new MutationObserver(async (mutations, observer) => {
				let oldScript = mutations
					.flatMap(e => [...e.addedNodes])
					.filter(e => e.tagName == 'SCRIPT')
					.find(e => e.src.includes("https://miniblox.io/assets/index"));

				if (oldScript) {
					observer.disconnect();
					execute(oldScript.src, oldScript);
				}
			}).observe(document, {
				childList: true,
				subtree: true,
			});
		}
	}
	else {
		execute(publicUrl);
	}
})();

//<CLICKGUI_HERE>