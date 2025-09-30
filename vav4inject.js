/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "6";

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

Object.getOwnPropertyNames = replaceAndCopyFunction(Object.getOwnPropertyNames, function (list) {
	if (list.indexOf(storeName) != -1) list.splice(list.indexOf(storeName), 1);
	return list;
});
Object.getOwnPropertyDescriptors = replaceAndCopyFunction(Object.getOwnPropertyDescriptors, function (list) {
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
	for (const [name, regex] of Object.entries(dumpedVarNames)) {
		const matched = modifiedText.match(regex);
		if (matched) {
			for (const [replacement, code] of Object.entries(replacements)) {
				delete replacements[replacement];
				replacements[replacement.replaceAll(name, matched[1])] = [code[0].replaceAll(name, matched[1]), code[1]];
			}
		}
	}
	const unmatchedDumps = Object.entries(dumpedVarNames).filter(e => !modifiedText.match(e[1]));
	if (unmatchedDumps.length > 0) console.warn("Unmatched dumps:", unmatchedDumps);

	const unmatchedReplacements = Object.entries(replacements).filter(r => modifiedText.replace(r[0]) === text);
	if (unmatchedReplacements.length > 0) console.warn("Unmatched replacements:", unmatchedReplacements);

	for (const [replacement, code] of Object.entries(replacements)) {
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

(function () {
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

		// a list of miniblox usernames to not attack / ignore
		/** @type string[] **/
		const friends = [];
		let ignoreFriends = false;

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
		let useAccountGen, accountGenEndpoint;
		let attackTime = Date.now();
		let chatDelay = Date.now();

		async function generateAccount() {
			toast({
				title: "generating miniblox account via integration...",
				status: "info",
				duration: 0.3e3
			});
			const res = await fetch(accountGenEndpoint[1]);
			if (!res.ok)
				throw await res.text();
			const j = await res.json();
			toast({
				title: \`Generated miniblox account! named \${j.name}!\`,
				status: "success",
				duration: 1e3
			});
			return j;
		}

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
	FilterBypass: "\\ character",
	NameTags: "Custom",
	AutoClicker: "RMB",
	AutoQueue: "Instant",
	ChestSteal: "Hypixel",
	KeepSprint: "All",
	InvCleaner: "Sigma",
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
				game.connect(lastJoined);
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

	// PLAYER ESP (created by TheM1ddleM1n :D)
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
		'new SPacketLoginStart({' +
		'requestedUuid:localStorage.getItem(REQUESTED_UUID_KEY)??void 0,' +
		'session:localStorage.getItem(SESSION_TOKEN_KEY)??"",' +
		'hydration:localStorage.getItem("hydration")??"0",' +
		'metricsId:localStorage.getItem("metrics_id")??"",' +
		'clientVersion:VERSION$1' +
		'})',
		'new SPacketLoginStart({' +
		'requestedUuid: void 0, ' +
		'session: (enabledModules["AntiBan"] ? useAccountGen[1] ? (await generateAccount()).session : "" : (localStorage.getItem(SESSION_TOKEN_KEY) ?? "")), ' +
		'hydration: "0", ' +
		'metricsId: uuid$1(), ' +
		'clientVersion: VERSION$1' +
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
			case ".friend": {
				const mode = args[1];
				if (!mode) {
					game.chat.addChat({text: "Usage: .friend <add|remove> <username> OR .friend list"});
					return;
				}
				const name = args[2];
				if (mode !== "list" && !name) {
					game.chat.addChat({text: "Usage: .friend <add|remove> <username> OR .friend list"});
					return;
				}
				switch (args[1]) {
					case "add":
						friends.push(name);
						game.chat.addChat({text: \`\\\\green\\\\added\\\\reset\\\\ \${name} as a friend \`});
						break;
					case "remove": {
						const idx = friends.indexOf(name);
						if (idx === -1) {
							game.chat.addChat({text:
								\`\\\\red\\\\Unknown\\\\reset\\\\ friend: \${name}\`});
							break;
						}
						friends.splice(idx, 1);
						break;
					}
					case "list":
						if (friends.length === 0) {
							game.chat.addChat({text: "You have no friends added yet!", color: "red"});
							game.chat.addChat({text:
								\`\\\\green\\\\Add\\\\reset\\\\ing friends using \\\\yellow\\\\.friend add <friend name>\\\\reset\\\\
								will make KillAura not attack them.\`
							});
							game.chat.addChat({text:
								\`\\\\green\\\\Removing\\\\reset\\\\ friends using
								\\\\yellow\\\\.friend remove <name>\\\\reset\\\\
								or toggling the \\\\yellow\\\\NoFriends\\\\reset\\\\ module
								will make KillAura attack them again.\`
							});
							break;
						}
						game.chat.addChat({text: "Friends:", color: "yellow"});
						for (const friend of friends) {
							game.chat.addChat({text: friend, color: "blue"});
						}
						break;
				}
				return this.closeInput();
			}
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

	// ANTI BLIND
	addModification("player.isPotionActive(Potions.blindness)", 'player.isPotionActive(Potions.blindness) && !enabledModules["AntiBlind"]', true);

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

			let clickDelay = Date.now();
			new Module("AutoClicker", function(callback) {
				if (callback) {
					tickLoop["AutoClicker"] = function() {
						if (clickDelay < Date.now() && playerControllerDump.key.leftClick && !player.isUsingItem()) {
							playerControllerDump.leftClick();
							clickDelay = Date.now() + 60;
						}
					}
				} else delete tickLoop["AutoClicker"];
			});
			new Module("AntiBlind", function() {});
			new Module("AntiCheat", function(callback) {
				if (!callback)
					return; 
				const entities = game.world.entitiesDump;
				for (const entity of entities) {
						if (!entity instanceof EntityPlayer)
							continue; 
						if (entity.mode.isCreative() || entity.mode.isSpectator())
							continue; 
				}
			})

            function reloadTickLoop(value) {
				if (game.tickLoop) {
					MSPT = value;
					clearInterval(game.tickLoop);
					game.tickLoop = setInterval(() => game.fixedUpdate(), MSPT);
				}
			}

			new Module("Sprint", function() {});
			const velocity = new Module("Velocity", function() {});
			velocityhori = velocity.addoption("Horizontal", Number, 0);
			velocityvert = velocity.addoption("Vertical", Number, 0);
   
			// Nofall beta?
   			let noFallExtraYBeta;
			const NoFallBeta = new Module("NoFallBeta", function(callback) {
				if (callback) {
					tickLoop["NoFallBeta"] = function() {
						// check if the player is falling and above a block
						// player.fallDistance = 0;
						const boundingBox = player.getEntityBoundingBox();
						const clone = boundingBox.min.clone();
						clone.y -= noFallExtraYBeta[1];
						const block = rayTraceBlocks(boundingBox.min, clone, true, false, false, game.world);
						if (block) {
							sendY = player.pos.y + noFallExtraYBeta[1];
						}
					}
				} else {
					delete tickLoop["NoFallBeta"];
				}
			});
			noFallExtraYBeta = NoFallBeta.addoption("extraY", Number, .41);


			// NoFall
			new Module("NoFall", function(callback) {
				if (!callback) {
					delete tickLoop["NoFall"];
	 				// only other module that uses desync right now is Fly.
	  				if (!fly.enabled) desync = false;
					return;
				}
				let shouldDesync = false;
				tickLoop["NoFall"] = function() {
					if (!desync && shouldDesync) desync = true;
	 				// this will force desync off even if fly is on, but I'm too lazy to make an entire priority system
	  				// or something just to fix the 0 uses of fly while you're on the ground
	 				else if (player.onGround && shouldDesync && desync) desync = false;
	  				shouldDesync = !player.onGround && player.motionY < -0.6 && player.fallDistance >= 2.5;
				};
			});

			// WTap
			new Module("WTap", function() {});

			// AntiFall
			new Module("AntiFall", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["AntiFall"] = function() {
        				const ray = rayTraceBlocks(player.getEyePos(), player.getEyePos().clone().setY(0), false, false, false, game.world);
						if (!ray) {
							player.motion.y = 0;
						}
					};
				}
				else delete tickLoop["AntiFall"];
			});

			// Killaura
			let attackDelay = Date.now();
			let didSwing = false;
			let attacked = 0;
			let attackedPlayers = {};
			let boxMeshes = [];
			let killaurarange, killaurablock, killaurabox, killauraangle, killaurawall, killauraitem;

			function wrapAngleTo180_radians(j) {
				return j = j % (2 * Math.PI),
				j >= Math.PI && (j -= 2 * Math.PI),
				j < -Math.PI && (j += 2 * Math.PI),
				j
			}

			function killauraAttack(entity, first) {
				if (attackDelay < Date.now()) {
					const aimPos = player.pos.clone().sub(entity.pos);
					const newYaw = wrapAngleTo180_radians(Math.atan2(aimPos.x, aimPos.z) - player.lastReportedYawDump);
					const checkYaw = wrapAngleTo180_radians(Math.atan2(aimPos.x, aimPos.z) - player.yaw);
					if (first) sendYaw = Math.abs(checkYaw) > degToRad(30) && Math.abs(checkYaw) < degToRad(killauraangle[1]) ? player.lastReportedYawDump + newYaw : false;
					if (Math.abs(newYaw) < degToRad(30)) {
						if ((attackedPlayers[entity.id] || 0) < Date.now()) attackedPlayers[entity.id] = Date.now() + 100;
						if (!didSwing) {
							hud3D.swingArm();
							ClientSocket.sendPacket(new SPacketClick({}));
							didSwing = true;
						}
						const box = entity.getEntityBoundingBox();
						const hitVec = player.getEyePos().clone().clamp(box.min, box.max);
						attacked++;
						playerControllerMP.syncItemDump();

						// this.fallDistance > 0
						// && !this.onGround
						// && !this.isOnLadder()
						// && !this.inWater
						// && attacked instanceof EntityLivingBase
						// && this.ridingEntity == null

						const couldCrit = player.ridingEntity == null && !player.inWater
							&& !player.isOnLadder();

						if (couldCrit) {
							// TODO: off ground crits? idk how to make it also bypass with fly but lol
							if (!player.onGround || player.fallDistance > 0) {
								return;
							}
							const offsets = [
								0.08, -0.07840000152
							];
						 	for (const offset of offsets) {
						 		const pos = {
						 			x: player.pos.x,
						 			y: player.pos.y + offset,
						 			z: player.pos.z
						 		};
						 		ClientSocket.sendPacket(new SPacketPlayerPosLook({
						 			pos,
									onGround: false
						 		}));
						 	}
						 }

						ClientSocket.sendPacket(new SPacketUseEntity({
							id: entity.id,
							action: 1,
							hitVec: new PBVector3({
								x: hitVec.x,
								y: hitVec.y,
								z: hitVec.z
							})
						}));
						player.attackDump(entity);
					}
				}
			}

			function swordCheck() {
				const item = player.inventory.getCurrentItem();
				return item && item.getItem() instanceof ItemSword;
			}

			function block() {
				if (attackDelay < Date.now()) attackDelay = Date.now() + (Math.round(attacked / 2) * 100);
				if (swordCheck() && killaurablock[1]) {
					if (!blocking) {
						playerControllerMP.syncItemDump();
						ClientSocket.sendPacket(new SPacketUseItem);
						blocking = true;
					}
				} else blocking = false;
			}

			function unblock() {
				if (blocking && swordCheck()) {
					playerControllerMP.syncItemDump();
					ClientSocket.sendPacket(new SPacketPlayerAction({
						position: BlockPos.ORIGIN.toProto(),
						facing: EnumFacing.DOWN.getIndex(),
						action: PBAction.RELEASE_USE_ITEM
					}));
				}
				blocking = false;
			}

			function getTeam(entity) {
				const entry = game.playerList.playerDataMap.get(entity.id);
				if (!entry) return;
				return entry.color != "white" ? entry.color : undefined;
			}

			new Module("NoFriends", function(enabled) {
				ignoreFriends = enabled;
			})

			let killAuraAttackInvisible;
			let attackList = [];
			const killaura = new Module("Killaura", function(callback) {
				if (callback) {
					for(let i = 0; i < 10; i++) {
						const mesh = new Mesh(new boxGeometryDump(1, 2, 1));
						mesh.material.depthTest = false;
						mesh.material.transparent = true;
						mesh.material.opacity = 0.5;
						mesh.material.color.set(255, 0, 0);
						mesh.renderOrder = 6;
						game.gameScene.ambientMeshes.add(mesh);
						boxMeshes.push(mesh);
					}
					tickLoop["Killaura"] = function() {
						attacked = 0;
						didSwing = false;
						const localPos = controls.position.clone();
						const localTeam = getTeam(player);
						const entities = game.world.entitiesDump;

						const sqRange = killaurarange[1] * killaurarange[1];
						const entities2 = Array.from(entities.values());
						attackList = entities2.filter(e => {
							const base = e instanceof EntityPlayer && e.id != player.id;
							if (!base) return false;
							const distCheck = player.getDistanceSqToEntity(e) < sqRange;
							if (!distCheck) return false;
							const isFriend = friends.includes(e.name);
							const friendCheck = !ignoreFriends && isFriend;
							if (friendCheck) return false;
							// pasted
							const {mode} = e;
							if (mode.isSpectator() || mode.isCreative()) return false;
							const invisCheck = killAuraAttackInvisible[1] || e.isInvisibleDump();
							if (!invisCheck) return false;
							const teamCheck = localTeam && localTeam == getTeam(e);
							if (teamCheck) return false;
							const wallCheck = killaurawall[1] && !player.canEntityBeSeen(e);
							if (wallCheck) return false;
							return true;
						})

						attackList.sort((a, b) => {
							return (attackedPlayers[a.id] || 0) > (attackedPlayers[b.id] || 0) ? 1 : -1;
						});

						for(const entity of attackList) killauraAttack(entity, attackList[0] == entity);

						if (attackList.length > 0) block();
						else {
							unblock();
							sendYaw = false;
						}
					};

					renderTickLoop["Killaura"] = function() {
						for(let i = 0; i < boxMeshes.length; i++) {
							const entity = attackList[i];
							const box = boxMeshes[i];
							box.visible = entity != undefined && killaurabox[1];
							if (box.visible) {
								const pos = entity.mesh.position;
								box.position.copy(new Vector3$1(pos.x, pos.y + 1, pos.z));
							}
						}
					};
				}
				else {
					delete tickLoop["Killaura"];
					delete renderTickLoop["Killaura"];
					for(const box of boxMeshes) box.visible = false;
					boxMeshes.splice(boxMeshes.length);
					sendYaw = false;
					unblock();
				}
			});
			killaurarange = killaura.addoption("Range", Number, 9);
			killauraangle = killaura.addoption("Angle", Number, 360);
			killaurablock = killaura.addoption("AutoBlock", Boolean, true);
			killaurawall = killaura.addoption("Wallcheck", Boolean, false);
			killaurabox = killaura.addoption("Box", Boolean, true);
			killauraitem = killaura.addoption("LimitToSword", Boolean, false);
			killAuraAttackInvisible = killaura.addoption("AttackInvisbles", Boolean, true);

			new Module("FastBreak", function() {});

			function getMoveDirection(moveSpeed) {
				let moveStrafe = player.moveStrafeDump;
				let moveForward = player.moveForwardDump;
				let speed = moveStrafe * moveStrafe + moveForward * moveForward;
				if (speed >= 1e-4) {
					speed = Math.sqrt(speed), speed < 1 && (speed = 1), speed = 1 / speed, moveStrafe = moveStrafe * speed, moveForward = moveForward * speed;
					const rt = Math.cos(player.yaw) * moveSpeed;
					const nt = -Math.sin(player.yaw) * moveSpeed;
					return new Vector3$1(moveStrafe * rt - moveForward * nt, 0, moveForward * rt + moveStrafe * nt);
				}
				return new Vector3$1(0, 0, 0);
			}

			// Fly
			let flyvalue, flyvert, flybypass;
			const fly = new Module("Fly", function(callback) {
				if (!callback) {
					if (player) {
						player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
						player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
					}
					delete tickLoop["Fly"];
					desync = false;
					return;
				}
				desync = true;
				tickLoop["Fly"] = function() {
					const dir = getMoveDirection(flyvalue[1]);
					player.motion.x = dir.x;
					player.motion.z = dir.z;
					player.motion.y = keyPressedDump("space") ? flyvert[1] : (keyPressedDump("shift") ? -flyvert[1] : 0);
				};
			});
			flybypass = fly.addoption("Bypass", Boolean, true);
			flyvalue = fly.addoption("Speed", Number, 0.18);
			flyvert = fly.addoption("Vertical", Number, 0.3);
			
   
   			let jetpackvalue, jetpackvert, jetpackUpMotion, jetpackGlide;
			// jetpack
			const jetpack = new Module("JetPack", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["JetPack"] = function() {
						ticks++;
						const dir = getMoveDirection(jetpackvalue[1]);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						const goUp = keyPressedDump("space");
						const goDown = false; 		//keyPressedDump("shift"), might not be needed
						if (goUp || goDown) {
							player.motion.y = goUp ? jetpackvert[1] : -jetpackvert[1];
						} else {
							player.motion.y = (ticks < 18 && ticks % 6 < 4 ? jetpackUpMotion[1] : -jetpackGlide[1]);
						}
					};
				}
				else {
					delete tickLoop["JetPack"];
					if (player) {
						player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
						player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
					}
				}
			});
			jetpackvalue = jetpack.addoption("Speed", Number, 0.18);
			jetpackGlide = jetpack.addoption("Glide", Number, 0.27);
			jetpackUpMotion = jetpack.addoption("UpMotion", Number, 0.27);
			jetpackvert = jetpack.addoption("Vertical", Number, 0.27);


   
			// InfiniteFly
			let infiniteFlyVert, infiniteFlyLessGlide;
			let warned = false;
			const infiniteFly = new Module("InfiniteFly", function(callback) {
				if (callback) {
					if (!warned) {
						game.chat.addChat({text:
							\`Infinite Fly only works on servers using the old ac
(KitPvP, Skywars, Eggwars, Bridge Duels,
Classic PvP, and OITQ use the new ac, everything else is using the old ac)\`});
						warned = true;
					}
					let ticks = 0;
					tickLoop["InfiniteFly"] = function() {
						sendGround = undefined;
						ticks++;
						const dir = getMoveDirection(0.37799);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						const goUp = keyPressedDump("space");
						const goDown = keyPressedDump("shift");
						sendGround = true;
						if (ticks < 6 && !goUp && !goDown) {
							player.motion.y = 0;
							return;
						}
						if (goUp || goDown) {
							player.motion.y = goUp ? infiniteFlyVert[1] : -infiniteFlyVert[1];
						} else if (!infiniteFlyLessGlide[1] || ticks % 2 === 0) {
							player.motion.y = 0.18;
						}
					};
				}
				else {
					delete tickLoop["InfiniteFly"];
					if (!infiniteFlyLessGlide[1]) return;
					// due to us not constantly applying the motion y while flying,
					// we can't instantly stop.
					// we have to wait a few ticks before allowing the player to move.
					let ticks = 0;
					tickLoop["InfiniteFlyStop"] = function() {
						if (player && ticks < 4) {
							player.motion.y = 0.18;
							ticks++;
						} else {
							delete tickLoop["InfiniteFlyStop"];
						}
					}
				}
			});
			infiniteFlyVert = infiniteFly.addoption("Vertical", Number, 0.15);  // Wont rubberband this way! same for fly
			infiniteFlyLessGlide = infiniteFly.addoption("LessGlide", Boolean, true);

			new Module("InvWalk", function() {});
			new Module("KeepSprint", function() {});
			new Module("NoSlowdown", function() {});

			// Speed
			let speedvalue, speedjump, speedauto;
			const speed = new Module("Speed", function(callback) {
				if (callback) {
					let lastjump = 10;
					tickLoop["Speed"] = function() {
						lastjump++;
						const oldMotion = new Vector3$1(player.motion.x, 0, player.motion.z);
						const dir = getMoveDirection(Math.max(oldMotion.length(), speedvalue[1]));
						lastjump = player.onGround ? 0 : lastjump;
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						player.motion.y = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space") ? speedjump[1] : player.motion.y;
					};
				}
				else delete tickLoop["Speed"];
			});
			speedvalue = speed.addoption("Speed", Number, 0.39);
			speedjump = speed.addoption("JumpHeight", Number, 0.42);
			speedauto = speed.addoption("AutoJump", Boolean, true);

			const step = new Module("Step", function() {});
			stepheight = step.addoption("Height", Number, 2);

			new Module("ESP", function() {});
			new Module("ChinaHat", function() {});
			const textgui = new Module("TextGUI", function() {});
			textguifont = textgui.addoption("Font", String, "Poppins");
			textguisize = textgui.addoption("TextSize", Number, 14);
			textguishadow = textgui.addoption("Shadow", Boolean, true);
			textgui.toggle();
			new Module("AutoRespawn", function() {});

			// Breaker
			let breakerrange;
			const breaker = new Module("Breaker", function(callback) {
				if (callback) {
					let attemptDelay = {};
					tickLoop["Breaker"] = function() {
						if (breakStart > Date.now()) return;
						let offset = breakerrange[1];
						for (const block of BlockPos.getAllInBoxMutable(new BlockPos(player.pos.x - offset, player.pos.y - offset, player.pos.z - offset), new BlockPos(player.pos.x + offset, player.pos.y + offset, player.pos.z + offset))) {
							if (game.world.getBlockState(block).getBlock() instanceof BlockDragonEgg) {
								if ((attemptDelay[block] || 0) > Date.now()) continue;
								attemptDelay[block] = Date.now() + 500;
								ClientSocket.sendPacket(new SPacketClick({
									location: block
								}));
							}
						}
					}
				}
				else delete tickLoop["Breaker"];
			});
			breakerrange = breaker.addoption("Range", Number, 10);

			function getItemStrength(stack) {
				if (stack == null) return 0;
				const itemBase = stack.getItem();
				let base = 1;

				if (itemBase instanceof ItemSword) base += itemBase.attackDamage;
				else if (itemBase instanceof ItemArmor) base += itemBase.damageReduceAmountDump;

				const nbttaglist = stack.getEnchantmentTagList();
				if (nbttaglist != null) {
					for (let i = 0; i < nbttaglist.length; ++i) {
						const id = nbttaglist[i].id;
						const lvl = nbttaglist[i].lvl;

						if (id == Enchantments.sharpness.effectId) base += lvl * 1.25;
						else if (id == Enchantments.protection.effectId) base += Math.floor(((6 + lvl * lvl) / 3) * 0.75);
						else if (id == Enchantments.efficiency.effectId) base += (lvl * lvl + 1);
						else if (id == Enchantments.power.effectId) base += lvl;
						else base += lvl * 0.01;
					}
				}

				return base * stack.stackSize;
			}

			// AutoArmor
			function getArmorSlot(armorSlot, slots) {
				let returned = armorSlot;
				let dist = 0;
				for(let i = 0; i < 40; i++) {
					const stack = slots[i].getHasStack() ? slots[i].getStack() : null;
					if (stack && stack.getItem() instanceof ItemArmor && (3 - stack.getItem().armorType) == armorSlot) {
						const strength = getItemStrength(stack);
						if (strength > dist) {
							returned = i;
							dist = strength;
						}
					}
				}
				return returned;
			}

			new Module("AutoArmor", function(callback) {
				if (callback) {
					tickLoop["AutoArmor"] = function() {
						if (player.openContainer == player.inventoryContainer) {
							for(let i = 0; i < 4; i++) {
								const slots = player.inventoryContainer.inventorySlots;
								const slot = getArmorSlot(i, slots);
								if (slot != i) {
									if (slots[i].getHasStack()) {
										playerControllerDump.windowClickDump(player.openContainer.windowId, i, 0, 0, player);
										playerControllerDump.windowClickDump(player.openContainer.windowId, -999, 0, 0, player);
									}
									playerControllerDump.windowClickDump(player.openContainer.windowId, slot, 0, 1, player);
								}
							}
						}
					}
				}
				else delete tickLoop["AutoArmor"];
			});

			function craftRecipe(recipe) {
				if (canCraftItem(player.inventory, recipe)) {
					craftItem(player.inventory, recipe, false);
					ClientSocket.sendPacket(new SPacketCraftItem({
						data: JSON.stringify({
							recipe: recipe,
							shiftDown: false
						})
					}));
					playerControllerDump.windowClickDump(player.openContainer.windowId, 36, 0, 0, player);
				}
			}

			let checkDelay = Date.now();
			new Module("AutoCraft", function(callback) {
				if (callback) {
					tickLoop["AutoCraft"] = function() {
						if (checkDelay < Date.now() && player.openContainer == player.inventoryContainer) {
							checkDelay = Date.now() + 300;
							if (!player.inventory.hasItem(Items.emerald_sword)) craftRecipe(recipes[1101][0]);
						}
					}
				}
				else delete tickLoop["AutoCraft"];
			});

			let cheststealblocks, cheststealtools;
			const cheststeal = new Module("ChestSteal", function(callback) {
				if (callback) {
					tickLoop["ChestSteal"] = function() {
						if (player.openContainer && player.openContainer instanceof ContainerChest) {
							for(let i = 0; i < player.openContainer.numRows * 9; i++) {
								const slot = player.openContainer.inventorySlots[i];
								const item = slot.getHasStack() ? slot.getStack().getItem() : null;
								if (item && (item instanceof ItemSword || item instanceof ItemArmor || item instanceof ItemAppleGold || cheststealblocks[1] && item instanceof ItemBlock || cheststealtools[1] && item instanceof ItemTool)) {
									playerControllerDump.windowClickDump(player.openContainer.windowId, i, 0, 1, player);
								}
							}
						}
					}
				}
				else delete tickLoop["ChestSteal"];
			});
			cheststealblocks = cheststeal.addoption("Blocks", Boolean, true);
			cheststealtools = cheststeal.addoption("Tools", Boolean, false);


			let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle;
let tickCount = 0;

function getPossibleSides(pos) {
    const possibleSides = [];
    for (const side of EnumFacing.VALUES) {
        const offset = side.toVector();
        const state = game.world.getBlockState(pos.add(offset.x, offset.y, offset.z));
        if (state.getBlock().material !== Materials.air) {
            possibleSides.push(side.getOpposite());
        }
    }
    return possibleSides.length > 0 ? possibleSides[0] : null;
}

function switchSlot(slot) {
    player.inventory.currentItem = slot;
    game.info.selectedSlot = slot;
}

const scaffold = new Module("DevScaffold", function(callback) {
    if (callback) {
        if (player) oldHeld = game.info.selectedSlot;

        tickLoop["DevScaffold"] = function() {
            tickCount++;

            // 🔁 Auto-select blocks & cycle between them
            let slotsWithBlocks = [];
            for (let i = 0; i < 9; i++) {
                const item = player.inventory.main[i];
                if (
                    item &&
                    item.item instanceof ItemBlock &&
                    item.item.block.getBoundingBox().max.y === 1 &&
                    item.item.name !== "tnt"
                ) {
                    slotsWithBlocks.push(i);
                }
            }

            if (slotsWithBlocks.length >= 2) {
                const selected = Math.floor(tickCount / scaffoldcycle[1]) % slotsWithBlocks.length;
                switchSlot(slotsWithBlocks[selected]);
            } else if (slotsWithBlocks.length > 0) {
                switchSlot(slotsWithBlocks[0]); // fallback
            }

            const item = player.inventory.getCurrentItem();
            if (!item || !(item.getItem() instanceof ItemBlock)) return;

            let flooredX = Math.floor(player.pos.x);
            let flooredY = Math.floor(player.pos.y);
            let flooredZ = Math.floor(player.pos.z);

            let futureX = player.pos.x + player.motion.x;
            let futureZ = player.pos.z + player.motion.z;
            let flooredFutureX = Math.floor(futureX);
            let flooredFutureZ = Math.floor(futureZ);

            let positionsToCheck = [
                new BlockPos(flooredX, flooredY - 1, flooredZ),
                new BlockPos(flooredFutureX, flooredY - 1, flooredFutureZ)
            ];

            for (let pos of positionsToCheck) {
                if (game.world.getBlockState(pos).getBlock().material === Materials.air) {
                    let placeSide = getPossibleSides(pos);

                    if (!placeSide) {
                        let closestSide = null;
                        let closestPos = null;
                        let closestDist = Infinity;

                        for (let x = -5; x <= 5; x++) {
                            for (let z = -5; z <= 5; z++) {
                                const newPos = new BlockPos(pos.x + x, pos.y, pos.z + z);
                                const side = getPossibleSides(newPos);
                                if (side) {
                                    const dist = player.pos.distanceTo(new Vector3$1(newPos.x, newPos.y, newPos.z));
                                    if (dist < closestDist) {
                                        closestDist = dist;
                                        closestSide = side;
                                        closestPos = newPos;
                                    }
                                }
                            }
                        }

                        if (closestPos) {
                            pos = closestPos;
                            placeSide = closestSide;
                        }
                    }

                    if (placeSide) {
                        const dir = placeSide.getOpposite().toVector();

                        let offsetX = dir.x;
                        let offsetY = dir.y;
                        let offsetZ = dir.z;

                        if (scaffoldextend[1] > 0) {
                            offsetX *= scaffoldextend[1];
                            offsetZ *= scaffoldextend[1];
                        }

                        const placeX = pos.x + offsetX;
                        const placeY = keyPressedDump("shift")
                            ? pos.y - (dir.y + 2)
                            : pos.y + dir.y;
                        const placeZ = pos.z + offsetZ;

                        const placePosition = new BlockPos(placeX, placeY, placeZ);

                        function randomFaceOffset(face) {
                            const rand = () => 0.1 + Math.random() * 0.8;
                            if (face.getAxis() === "Y") {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + (face === EnumFacing.UP ? 0.95 : 0.05) + Math.random() * 0.04,
                                    z: placePosition.z + rand()
                                };
                            } else if (face.getAxis() === "X") {
                                return {
                                    x: placePosition.x + (face === EnumFacing.EAST ? 0.95 : 0.05) + Math.random() * 0.04,
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + rand()
                                };
                            } else {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + (face === EnumFacing.SOUTH ? 0.95 : 0.05) + Math.random() * 0.04
                                };
                            }
                        }

                        const hitOffsets = randomFaceOffset(placeSide);
                        const hitVec = new Vector3$1(hitOffsets.x, hitOffsets.y, hitOffsets.z);

                        const dx = hitVec.x - player.pos.x;
                        const dy = hitVec.y - (player.pos.y + player.getEyeHeight());
                        const dz = hitVec.z - player.pos.z;
                        const distHorizontal = Math.sqrt(dx * dx + dz * dz);

                        const rotYaw = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
                        const rotPitch = -Math.atan2(dy, distHorizontal) * (180 / Math.PI);
                        player.rotationYaw = rotYaw;
                        player.rotationPitch = Math.max(-90, Math.min(90, rotPitch));

                        if (
                            scaffoldtower[1] &&
                            keyPressedDump("space") &&
                            dir.y === -1 &&
                            Math.abs(player.pos.x - flooredX - 0.5) < 0.2 &&
                            Math.abs(player.pos.z - flooredZ - 0.5) < 0.2
                        ) {
                            if (player.motion.y < 0.2 && player.motion.y > 0.15) {
                                player.motion.y = 0.42;
                            }
                        }

                        if (keyPressedDump("shift") && dir.y === 1) {
                            if (player.motion.y > -0.2 && player.motion.y < -0.15) {
                                player.motion.y = -0.42;
                            }
                        }

                        if (playerControllerDump.onPlayerRightClick(player, game.world, item, placePosition, placeSide, hitVec)) {
                            hud3D.swingArm();
                        }

                        if (item.stackSize === 0) {
                            player.inventory.main[player.inventory.currentItem] = null;
                        }
                    }

                    break; // ✅ Stop checking after placing
                }
            }
        };
    } else {
        if (player && oldHeld !== undefined) {
            switchSlot(oldHeld);
        }
        delete tickLoop["DevScaffold"];
    }
});

scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);

			let timervalue;
			const timer = new Module("Timer", function(callback) {
				reloadTickLoop(callback ? 50 / timervalue[1] : 50);
			});
			timervalue = timer.addoption("Value", Number, 1.2);
			new Module("Phase", function() {});

			const antiban = new Module("AntiBan", function() {});
			antiban.toggle();

			useAccountGen = antiban.addoption("AccountGen", Boolean, false);
			accountGenEndpoint = antiban.addoption("GenServer", String, "http://localhost:8000/generate");
			new Module("AutoRejoin", function() {});
			new Module("AutoQueue", function() {});
			new Module("AutoVote", function() {});
			const chatdisabler = new Module("ChatDisabler", function() {});
			chatdisablermsg = chatdisabler.addoption("Message", String, "youtube.com/c/7GrandDadVape");
			new Module("FilterBypass", function() {});
   
    
    const InvCleaner = new Module("InvCleaner", function (callback) {
    if (!callback) {
        delete tickLoop["InvCleaner"];
        return;
    }

    const armorPriority = ["leather", "chain", "iron", "diamond"];
    const weaponClasses = new Set(["ItemSword", "ItemAxe", "ItemBow", "ItemPickaxe"]);
    const essentials = ["gapple", "golden apple", "ender pearl", "fire charge"];
    const customKeep = ["god helmet", "legend boots"];
    const bestArmor = {};
    const bestItems = {};
    let lastRun = 0;
    const seenItems = {};

    function getArmorScore(stack) {
        const item = stack.getItem();
        const material = item.getArmorMaterial?.()?.toLowerCase?.() ?? "unknown";
        const priority = armorPriority.indexOf(material);
        const durability = stack.getMaxDamage() - stack.getItemDamage();
        return (priority === -1 ? -999 : priority * 1000) + durability;
    }

    function getMaterialScore(name) {
        name = name.toLowerCase();
        if (name.includes("diamond")) return 4;
        if (name.includes("iron")) return 3;
        if (name.includes("chain")) return 2;
        if (name.includes("wood")) return 1;
        return 0;
    }

    function getScore(stack, item) {
        const damage = item.getDamageVsEntity?.() ?? 0;
        const enchants = stack.getEnchantmentTagList()?.length ?? 0;
        const material = getMaterialScore(stack.getDisplayName());
        return damage + enchants * 1.5 + material * 0.5;
    }

    function isSameItem(a, b) {
        if (!a || !b) return false;
        const nameA = a.stack.getDisplayName()?.toLowerCase();
        const nameB = b.stack.getDisplayName()?.toLowerCase();
        const enchA = a.stack.getEnchantmentTagList()?.toString();
        const enchB = b.stack.getEnchantmentTagList()?.toString();
        return nameA === nameB && enchA === enchB;
    }

    function shouldKeep(stack) {
        const name = stack.getDisplayName().toLowerCase();
        return essentials.some(k => name.includes(k)) || customKeep.some(k => name.includes(k));
    }

    tickLoop["InvCleaner"] = function () {
        const now = Date.now();
        if (now - lastRun < 100) return;
        lastRun = now;

        const slots = player?.inventoryContainer?.inventorySlots;
        if (!player.openContainer || player.openContainer !== player.inventoryContainer || !slots || slots.length < 36) return;

        Object.keys(bestArmor).forEach(k => delete bestArmor[k]);
        Object.keys(bestItems).forEach(k => delete bestItems[k]);
        Object.keys(seenItems).forEach(k => delete seenItems[k]);

        const toDrop = [];

        // Preload equipped armor
        [5, 6, 7, 8].forEach(i => {
            const stack = slots[i]?.getStack();
            if (stack?.getItem() instanceof ItemArmor) {
                const armorType = stack.getItem().armorType ?? "unknown";
                bestArmor["armor_" + armorType] = { stack, index: i, score: getArmorScore(stack) };
            }
        });

        for (let i = 0; i < 36; i++) {
            const stack = slots[i]?.getStack();
            if (!stack) continue;

            const item = stack.getItem();
            const className = item.constructor.name;

            if (shouldKeep(stack)) continue;

            if (item instanceof ItemArmor) {
                const armorType = item.armorType ?? "unknown";
                const key = "armor_" + armorType;
                const score = getArmorScore(stack);
                const existing = bestArmor[key];

                if (!existing) {
                    bestArmor[key] = { stack, index: i, score };
                } else {
                    if (score > existing.score) {
                        toDrop.push(existing.index);
                        bestArmor[key] = { stack, index: i, score };
                    } else {
                        toDrop.push(i);
                    }
                }
                continue;
            }

            if (weaponClasses.has(className)) {
                const score = getScore(stack, item);
                const existing = bestItems[className];

                if (!existing || score > existing.score) {
                    if (existing && existing.index !== i) toDrop.push(existing.index);
                    bestItems[className] = { stack, score, index: i };
                } else if (existing && isSameItem(bestItems[className], { stack })) {
                    toDrop.push(i);
                } else {
                    toDrop.push(i);
                }
                continue;
            }

            const name = stack.getDisplayName()?.toLowerCase() ?? "";
            if (!shouldKeep(stack)) {
                if (seenItems[name]) {
                    toDrop.push(i);
                } else {
                    seenItems[name] = true;
                }
            }
        }

        toDrop.forEach(dropSlot);
    };
});

function dropSlot(index) {
    const windowId = player.openContainer.windowId;
    playerControllerDump.windowClickDump(windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(windowId, -999, 0, 0, player);
}

let funnyMessages = [
"Prediction ACs: great at guessing wrong.",
"Lag spikes? Blame the AC trying to play psychic.",
"Jesus walked on water. ACs still trip over puddles.",
"Walking on air? ACs call it a glitch. We call it precision.",
"Prediction ACs eat packets 4 breakfast. Too bad they choke on velocity.",
"Gravity’s a suggestion. ACs treat it like gospel.",
"Scaffold smoother than your AC’s excuses.",
"Tick-perfect bridging. ACs still counting frames.",
"Snapped into water? ACs thought you were a fish.",
"Water-walking? ACs still learning to swim.",
"Falling? Nah. Just descending with style while ACs panic.",
"Patch notes say 'fixed.' Reality says 'still broken.'",
"Bypass? No. ACs just forgot how to detect.",
"Modules adapt. ACs react — poorly.",
"Silent movement. Loud AC confusion.",
"Prediction? Velocity? ACs still buffering.",
"No permission asked. ACs weren’t invited.",
"Every module is a flex. ACs just fold.",
"No config needed. ACs still reading the manual.",
"Toggle. Deliver. ACs scramble.",
"ACs don’t detect. They guess and hope.",
"Unleashed. ACs unleashed their incompetence.",
"No drama. Just full domination over servers.",
"ACs getting patched? We evolve.",
"Cheating? No. Just outperforming your AC’s imagination.",
"Toggle scaffold. Build legacy. ACs build logs no one reads.",
"Flinch? ACs do. We don’t.",
"Modules = superpowers. ACs = kryptonite to themselves.",
"ACs call it daddy. We call it Tuesday.",
"Still undetected. Still undefeated. ACs still confused.",
"Toggle one module. Server cries. ACs sob.",
"Patch notes scared. ACs terrified.",
"Your client warned you. ACs didn’t listen.",
"Smooth as silk. ACs still stuck in sandpaper mode.",
"Stealth so clean, ACs think it's a ghost."
];

const AutoFunnyChat = new Module("AutoFunnyChat", function(callback) {
    if (!callback) {
        delete tickLoop["AutoFunnyChat"];
        if (window.__autoFunnyKillMsgListener) {
            ClientSocket.off && ClientSocket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
            window.__autoFunnyKillMsgListener = undefined;
        }
        return;
    }
    // Periodic random funny message
    let lastSent = 0;
    tickLoop["AutoFunnyChat"] = function() {
        if (Date.now() - lastSent > 40000) { // Sends every 40 seconds
            const msg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
            ClientSocket.sendPacket(new SPacketMessage({text: msg}));
            lastSent = Date.now();
        }
    };

    // Also send on kill events (Miniblox chat detection)
    if (!window.__autoFunnyKillMsgListener) {
        window.__autoFunnyKillMsgListener = function(h) {
            if (
                h.text &&
                (
                    h.text.includes("You eliminated") ||
                    h.text.includes("You knocked out") ||
                    h.text.includes("You sent") ||
                    (h.text.includes("eliminated by") && h.text.includes(player.name)) ||
                    h.text.includes(player.name + " eliminated")
                )
            ) {
                const msg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
                setTimeout(function() {
                    ClientSocket.sendPacket(new SPacketMessage({text: msg}));
                }, 500 + Math.random() * 1000); // slight delay for realism
            }
        };
        ClientSocket.on("CPacketMessage", window.__autoFunnyKillMsgListener);
    }
});

const jesus = new Module("Jesus", function(callback) {
    if (callback) {
        tickLoop["Jesus"] = function() {
            const posX = Math.floor(player.pos.x);
            const posY = Math.floor(player.pos.y - 0.01);
            const posZ = Math.floor(player.pos.z);

            const blockBelow = game.world.getBlockState(new BlockPos(posX, posY, posZ)).getBlock();
            const isLiquid = blockBelow.material === Materials.water || blockBelow.material === Materials.lava;

            if (isLiquid) {
                // Prevent sinking
                player.motion.y = 0;

                // Lock Y position to surface
                player.pos.y = Math.floor(player.pos.y);

                // Spoof ground contact
                player.onGround = true;

                // Optional bounce when jumping
                if (keyPressedDump("space")) {
                    player.motion.y = 0.42;
                }
            }
        };
    } else {
        delete tickLoop["Jesus"];
    }
});

// LongJump (Created by TheM1ddleM1n)
let ljpower, ljboost, ljdesync;
const longjump = new Module("LongJump", function(callback) {
    if (!callback) {
        delete tickLoop["LongJump"];
        desync = false;
        return;
    }

    desync = ljdesync[1];
    let jumping = false;
    let boostTicks = 0;

    tickLoop["LongJump"] = function() {
        if (!player) return;

        // Detect jump key
        if (keyPressedDump("space") && player.onGround && !jumping) {
            jumping = true;
            boostTicks = ljboost[1];
            player.motion.y = 0.42; // vanilla mc jump power lol
        }

        if (jumping) {
            const dir = getMoveDirection(ljpower[1]);
            player.motion.x = dir.x;
            player.motion.z = dir.z;

            boostTicks--;
            if (boostTicks <= 0 || player.onGround) {
                jumping = false;
            }
        }
    };
});

// Options
ljpower  = longjump.addoption("Power", Number, 0.6);   // horizontal boost
ljboost  = longjump.addoption("BoostTicks", Number, 10); // how long boost lasts
ljdesync = longjump.addoption("Desync", Boolean, true);  // toggle desync mode

			globalThis.${storeName}.modules = modules;
			globalThis.${storeName}.profile = "default";
		})();
	`);

	async function saveVapeConfig(profile) {
		if (!loadedConfig) return;
		let saveList = {};
		for (const [name, module] of Object.entries(unsafeWindow.globalThis[storeName].modules)) {
			saveList[name] = { enabled: module.enabled, bind: module.bind, options: {} };
			for (const [option, setting] of Object.entries(module.options)) {
				saveList[name].options[option] = setting[1];
			}
		}
		GM_setValue("vapeConfig" + (profile ?? unsafeWindow.globalThis[storeName].profile), JSON.stringify(saveList));
		GM_setValue("mainVapeConfig", JSON.stringify({ profile: unsafeWindow.globalThis[storeName].profile }));
	};

	async function loadVapeConfig(switched) {
		loadedConfig = false;
		const loadedMain = JSON.parse(await GM_getValue("mainVapeConfig", "{}")) ?? { profile: "default" };
		unsafeWindow.globalThis[storeName].profile = switched ?? loadedMain.profile;
		const loaded = JSON.parse(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
		if (!loaded) {
			loadedConfig = true;
			return;
		}

		for (const [name, module] of Object.entries(loaded)) {
			const realModule = unsafeWindow.globalThis[storeName].modules[name];
			if (!realModule) continue;
			if (realModule.enabled != module.enabled) realModule.toggle();
			if (realModule.bind != module.bind) realModule.setbind(module.bind);
			if (module.options) {
				for (const [option, setting] of Object.entries(module.options)) {
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
		Object.defineProperty(unsafeWindow.globalThis, storeName, { value: {}, enumerable: false });
		if (oldScript) oldScript.type = 'javascript/blocked';
		await fetch(src).then(e => e.text()).then(e => modifyCode(e));
		if (oldScript) oldScript.type = 'module';
		await new Promise((resolve) => {
			const loop = setInterval(async function () {
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
		setInterval(async function () {
			saveVapeConfig();
		}, 10000);
	}

	const publicUrl = "scripturl";
	// https://stackoverflow.com/questions/22141205/intercept-and-alter-a-sites-javascript-using-greasemonkey
	if (publicUrl == "scripturl") {
		if (navigator.userAgent.indexOf("Firefox") != -1) {
			window.addEventListener("beforescriptexecute", function (e) {
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
// Added new Poppins font 
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
		console.error("[Cl1ckGU1] Init failed:", err);
	}

	function injectGUI(store) {
		const categories = {
			Combat: ["autoclicker", "killaura", "velocity", "wtap"],
			Movement: ["scaffold", "jesus", "phase", "nofall", "antifall", "sprint", "keepsprint", "step", "speed", "jetpack", "noslowdown"],
			Render: ["invcleaner", "invwalk", "autoarmor", "esp", "nametags+", "textgui", "clickgui", "longjump"],
			World: ["fastbreak", "breaker", "autocraft", "cheststeal", "timer", "creativemode"],
			Utility: ["autorespawn", "autorejoin", "autoqueue", "autovote", "filterbypass", "anticheat", "autofunnychat", "chatdisabler", "musicfix", "auto-funnychat", "music-fix"]
		};
		const catIcons = { Combat: "⚔️", Movement: "🏃", Render: "🧑👁️", World: "🌍", Utility: "🛠️" };

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
      .notif-wrap { position:fixed; bottom:40px; right:30px; display:flex; flex-direction:column; align-items:flex-end; pointer-events:none; z-index:999999; }
      .notif { display:flex; align-items:center; gap:8px; background:rgba(20,20,20,0.85); color:white; padding:10px 14px; margin-top:8px; border-radius:10px; font-family:"Poppins", sans-serif; font-size:13px; backdrop-filter:blur(6px); box-shadow:0 4px 12px rgba(0,0,0,0.4); opacity:1; transform:translateX(120%); transition:opacity .3s, transform .3s ease; border-left:4px solid; }
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

		// === Notifications ===
		const notifWrap = document.createElement("div");
		notifWrap.className = "notif-wrap";
		document.body.appendChild(notifWrap);
		function showNotif(msg, type = "info", dur = 3000) {
			const n = document.createElement("div");
			n.className = `notif ${type}`;
			let icon = type === "info" ? "ℹ️" : type === "success" ? "✅" : type === "warn" ? "⚠️" : "❌";
			n.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
			notifWrap.appendChild(n);
			setTimeout(() => (n.style.transform = "translateX(0)"), 30);
			setTimeout(() => { n.style.opacity = "0"; n.style.transform = "translateX(120%)"; }, dur);
			setTimeout(() => n.remove(), dur + 400);
		}

		// === Persistence helpers with localstorage ===
		function saveModuleState(name, mod) {
			const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
			const opts = {};
			if (mod.options) Object.entries(mod.options).forEach(([k, opt]) => { opts[k] = opt[1]; });
			saved[name] = { enabled: mod.enabled, bind: mod.bind, options: opts };
			localStorage.setItem("lb-mods", JSON.stringify(saved));
		}
		function loadModuleState(name, mod) {
			const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
			if (saved[name]) {
				if (saved[name].enabled !== mod.enabled && typeof mod.toggle === "function") mod.toggle();
				if (saved[name].bind) mod.setbind(saved[name].bind);
				if (saved[name].options && mod.options) Object.entries(saved[name].options).forEach(([k, v]) => { if (mod.options[k]) mod.options[k][1] = v; });
			}
		}

		// === Panels with slide collapsible content ===
		const panels = {};
		Object.keys(categories).forEach((cat, i) => {
			const panel = document.createElement("div");
			panel.className = "lb-panel";
			panel.style.left = 40 + i * 240 + "px";
			panel.style.top = "100px";

			const header = document.createElement("div");
			header.className = "lb-header";

			const collapseBtn = document.createElement("span");
			collapseBtn.style.float = "right";
			collapseBtn.style.cursor = "pointer";

			const titleSpan = document.createElement("span");
			titleSpan.textContent = `${catIcons[cat]} ${cat}`;

			header.appendChild(titleSpan);
			header.appendChild(collapseBtn);
			panel.appendChild(header);

			const saved = localStorage.getItem("lb-pos-" + cat);
			if (saved) { const { left, top } = JSON.parse(saved); panel.style.left = left; panel.style.top = top; }

			let dragging = false, offsetX, offsetY;
			header.addEventListener("mousedown", (e) => { dragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; });
			document.addEventListener("mousemove", (e) => { if (dragging) { panel.style.left = e.clientX - offsetX + "px"; panel.style.top = e.clientY - offsetY + "px"; } });
			document.addEventListener("mouseup", () => { if (dragging) { dragging = false; localStorage.setItem("lb-pos-" + cat, JSON.stringify({ left: panel.style.left, top: panel.style.top })); } });

			// collapse content
			const contentWrap = document.createElement("div");
			contentWrap.className = "lb-content";
			panel.appendChild(contentWrap);

			let collapsed = localStorage.getItem("lb-collapsed-" + cat) === "true";
			if (collapsed) contentWrap.classList.add("collapsed");
			collapseBtn.textContent = collapsed ? "[+]" : "[-]";

			collapseBtn.addEventListener("click", () => {
				collapsed = !collapsed;
				if (collapsed) contentWrap.classList.add("collapsed");
				else contentWrap.classList.remove("collapsed");
				collapseBtn.textContent = collapsed ? "[+]" : "[-]";
				localStorage.setItem("lb-collapsed-" + cat, collapsed);
			});

			panels[cat] = panel;
			document.body.appendChild(panel);
		});

		let isBinding = false;
		/** @type {Module | null} */
		let moduleToBindTo = null;
		/** @type {(key: string | undefined) => void | null} */
		let bindingCompletedCallback = null;

		// === Modules ===
		Object.entries(store.modules).forEach(([name, mod]) => {
			let cat = "Utility";
			for (const [c, keys] of Object.entries(categories)) if (keys.some((k) => name.toLowerCase().includes(k))) { cat = c; break; }
			loadModuleState(name, mod);
			const row = document.createElement("div");
			row.className = "lb-module" + (mod.enabled ? " active" : "");
			row.innerHTML = `<span>${name}</span><span>${mod.enabled ? "ON" : "OFF"}</span>`;
			const optionsBox = document.createElement("div");
			optionsBox.className = "lb-options";
			row.addEventListener("mousedown", (e) => {
				if (e.button === 0) {
					if (typeof mod.toggle === "function") mod.toggle();
					row.classList.toggle("active", mod.enabled);
					row.lastChild.textContent = mod.enabled ? "ON" : "OFF";
					showNotif(`${name} ${mod.enabled ? "enabled" : "disabled"}`, mod.enabled ? "success" : "error");
					saveModuleState(name, mod);
				}
			});
			row.addEventListener("contextmenu", (e) => { e.preventDefault(); optionsBox.classList.toggle("show"); });
			if (mod.options) Object.entries(mod.options).forEach(([key, opt]) => {
				const [type, val, label] = opt;
				const line = document.createElement("label");
				line.textContent = label;
				if (type === Boolean) { const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = val; cb.onchange = () => { opt[1] = cb.checked; saveModuleState(name, mod); }; line.appendChild(cb); }
				else if (type === Number) { const slider = document.createElement("input"); slider.type = "range"; const [min, max, step] = opt.range ?? [0, 10, 0.1]; slider.min = min; slider.max = max; slider.step = step; slider.value = val; slider.oninput = () => { opt[1] = parseFloat(slider.value); saveModuleState(name, mod); }; line.appendChild(slider); }
				else if (type === String) { const input = document.createElement("input"); input.type = "text"; input.value = val; input.onchange = () => { opt[1] = input.value; saveModuleState(name, mod); }; line.appendChild(input); }
				optionsBox.appendChild(line);
			});
			const bb = document.createElement("button");
			bb.textContent = "None";
			bb.addEventListener("click", () => {
				if (isBinding) {
					isBinding = false;
					moduleToBindTo = null;
				}
				isBinding = !isBinding;
				bb.textContent = "Listening for key presses (press ESC to stop)";
				moduleToBindTo = mod;
				bindingCompletedCallback = key => {
					bb.textContent = key ?? "None";
				}
			});
			optionsBox.appendChild(bb);

			panels[cat].querySelector(".lb-content").appendChild(row);
			panels[cat].querySelector(".lb-content").appendChild(optionsBox);
		});

		// === Reset / Config buttons (Utility panel) ===
		const resetRow = document.createElement("div");
		resetRow.className = "lb-module";
		resetRow.style.color = "#00aaff";
		resetRow.textContent = "↺ Reset Layout?";
		resetRow.addEventListener("click", () => {
			const defaults = {
				Combat: { left: "40px", top: "100px" },
				Movement: { left: "280px", top: "100px" },
				"Player / Render": { left: "520px", top: "100px" },
				World: { left: "760px", top: "100px" },
				Utility: { left: "1000px", top: "100px" }
			};
			Object.entries(defaults).forEach(([cat, pos]) => {
				localStorage.setItem("lb-pos-" + cat, JSON.stringify(pos));
				if (panels[cat]) { panels[cat].style.left = pos.left; panels[cat].style.top = pos.top; }
			});
			showNotif("Layout has been reset to default!", "success");
		});
		panels["Utility"].querySelector(".lb-content").appendChild(resetRow);

		const resetConfigRow = document.createElement("div");
		resetConfigRow.className = "lb-module";
		resetConfigRow.style.color = "red";
		resetConfigRow.textContent = "⛔ Reset Config?";
		resetConfigRow.addEventListener("click", () => {
			localStorage.removeItem("lb-mods");
			Object.keys(localStorage).filter((k) => k.startsWith("lb-pos-")).forEach((k) => localStorage.removeItem(k));
			Object.keys(localStorage).filter((k) => k.startsWith("lb-collapsed-")).forEach((k) => localStorage.removeItem(k));
			alert("Config has been reset!");
			location.reload();
		});
		panels["Utility"].querySelector(".lb-content").appendChild(resetConfigRow);

		// === Search ===
		const searchWrap = document.createElement("div");
		searchWrap.className = "lb-searchwrap";
		searchWrap.innerHTML = `<input type="text" class="lb-search" placeholder="Search...">`;
		document.body.appendChild(searchWrap);
		const searchBox = searchWrap.querySelector("input");
		searchBox.addEventListener("input", () => {
			const term = searchBox.value.toLowerCase();
			document.querySelectorAll(".lb-module").forEach((row) => {
				const name = row.firstChild.textContent.toLowerCase();
				row.style.display = name.includes(term) ? "flex" : "none";
			});
		});

		// === Hide on load ===
		Object.values(panels).forEach((p) => (p.style.display = "none"));
		searchWrap.style.display = "none";

		// === Loading screen startup notification! ===
		setTimeout(() => { showNotif("[ClickGUI@v5.8] Press \\\\ to open ClickGUI! Enjoy!", "info", 4000); }, 500);

		// === Toggle ClickGUI ===
		let visible = false;
		document.addEventListener("keydown", (e) => {
			// the ESC key shouldn't close the ClickGUI if we're binding something,
			// it should stop the bind's listener.

			if (isBinding) {
				// stop miniblox from trying to close
				// any game menus we have open
				e.preventDefault();
				e.stopPropagation();
				isBinding = false;
				bindingCompletedCallback?.(undefined);
				switch (e.key) {
					case "Escape":
						break;
					default:
						if (moduleToBindTo == null) {
							console.warn("so I'm supposed to bind a null module to this key? ok no.");
							return;
						}
						bindingCompletedCallback?.(e.key);
						moduleToBindTo.setbind(e.key);
						break;
				}
				return;
			}

			if (e.key === "\\" || e.key === "Escape") {
				visible = !visible;
				Object.values(panels).forEach((p) => (p.style.display = visible ? "block" : "none"));
				searchWrap.style.display = visible ? "block" : "none";
				e.preventDefault();
			}
		});
	}
})();
