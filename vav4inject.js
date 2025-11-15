/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "6.8.7";

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

	// DUMPS
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
// note: when using this desync,
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

		// a list of miniblox usernames to not attack / ignore (friends)
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
				title: \`Generated a miniblox account! named \${j.name}!\`,
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
	addModification('skinManager.loadTextures(),', ',this.loadVape(),');
	addModification('async loadSpritesheet(){', `
		async loadVape() {
			this.vapeTexture = await this.loader.loadAsync("https://raw.githubusercontent.com/ProgMEM-CC/miniblox.impact.client.updatedv2/refs/heads/main/favicon.png");
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
	// TEXT GUI
	addModification('(this.drawSelectedItemStack(),this.drawHintBox())', /*js*/`
	if (ctx$5 && enabledModules["TextGUI"]) {
		const canvasW = ctx$5.canvas.width;
		const canvasH = ctx$5.canvas.height;
		const colorOffset = (Date.now() / 4000);
		const posX = 15;
		const posY = 17;
		ctx$5.imageSmoothingEnabled = true;
		ctx$5.imageSmoothingQuality = "high";

		let offset = 0;
		let filtered = Object.values(modules).filter(m => m.enabled && m.name !== "TextGUI");

		filtered.sort((a, b) => {
			const aName = a.name;
			const bName = b.name;
			const compA = ctx$5.measureText(aName).width;
			const compB = ctx$5.measureText(bName).width;
			return compA < compB ? 1 : -1;
		});

		for (const module of filtered) {
			offset++;
			
			const fontStyle = \`\${textguisize[1]}px \${textguifont[1]}\`;
			ctx$5.font = fontStyle;

			// Build strings
			const rainbowText = module.name;
			const modeText = module.tag?.trim();

			const fullText = \`\${rainbowText}\${modeText ? " " + modeText : ""}\`;
			const textWidth = ctx$5.measureText(fullText).width;
			const x = canvasW - textWidth - posX;
			const y = posY + (textguisize[1] + 3) * offset;

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

			// Draw grey text-mode part (after rainbow width)
			if (modeText) {
				const rainbowWidth = ctx$5.measureText(rainbowText).width;
				drawText(
					ctx$5,
					modeText,
					x + rainbowWidth + 4,
					y,
					fontStyle,
					"#bbbbbb",
					"left",
					"top",
					1,
					textguishadow[1]
				);
			}

			// Reset the shadow
			ctx$5.shadowColor = "transparent";
			ctx$5.shadowBlur = 0;
			ctx$5.shadowOffsetX = 0;
			ctx$5.shadowOffsetY = 0;
		}

		// === Draw logo (bottom-right) ===
		const logo = textureManager.vapeTexture.image;
		const scale = 0.9;
		const logoW = logo.width * scale;
		const logoH = logo.height * scale;
		const logoX = canvasW - logoW - 15;
		const logoY = canvasH - logoH - 15;

		ctx$5.shadowColor = "rgba(0, 0, 0, 0.6)";
		ctx$5.shadowBlur = 6;
		drawImage(ctx$5, logo, logoX, logoY, logoW, logoH);
		ctx$5.shadowColor = "transparent";
		ctx$5.shadowBlur = 0;
	}
`);

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
		if (h.rank && h.rank != "" && RANK.LEVEL[h.rank].permLevel > 2) {
			game.chat.addChat({
				text: "STAFF HAS BEEN DETECTED : " + h.rank + "\\n".repeat(10),
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

	// PRE KILLAURA
	addModification('else player.isBlocking()?', 'else (player.isBlocking() || blocking)?', true);
	addModification('this.entity.isBlocking()', '(this.entity.isBlocking() || this.entity == player && blocking)', true);
	addModification('this.yaw-this.', '(sendYaw || this.yaw)-this.', true);
	addModification("x.yaw=player.yaw", 'x.yaw=(sendYaw || this.yaw)', true);
	addModification('this.lastReportedYawDump=this.yaw,', 'this.lastReportedYawDump=(sendYaw || this.yaw),', true);
	addModification('this.neck.rotation.y=controls.yaw', 'this.neck.rotation.y=(sendYaw||controls.yaw)', true);
	// hook this so we send `sendYaw` to the server,
	// since the new ac replicates the yaw from the input packet
	addModification("yaw:this.yaw", "yaw:(sendYaw || this.yaw)", true);
	// stops applyInput from changing our yaw and correcting our movement,
	// but that makes the server setback us
	// when we go too far from the predicted pos since we don't do correction
	// TODO, would it be better to send an empty input packet with the sendYaw instead?
	// I can't be asked to work on fixing this not working on the prediction ac
	addModification("this.yaw=h.yaw,this.pitch=h.pitch,", "", true);
	addModification(",this.setPositionAndRotation(this.pos.x,this.pos.y,this.pos.z,h.yaw,h.pitch)", "", true);

	// NOSLOWDOWN
	addModification('updatePlayerMoveState(),this.isUsingItem()', 'updatePlayerMoveState(),(this.isUsingItem() && !enabledModules["NoSlowdown"])', true);
	addModification('S&&!this.isUsingItem()', 'S&&!(this.isUsingItem() && !enabledModules["NoSlowdown"])', true);

	// DESYNC!
	addModification("this.inputSequenceNumber++", 'desync ? this.inputSequenceNumber : this.inputSequenceNumber++', true);
	// addModification("new PBVector3({x:this.pos.x,y:this.pos.y,z:this.pos.z})", "desync ? inputPos : inputPos = this.pos", true);

	// auto-reset the desync variable.
	addModification("reconcileServerPosition(h){", "serverPos = h;");

	// hook into the reconcileServerPosition
	// so we know our server pos

	// PREDICTION AC FIXER (makes the ac a bit less annoying (e.g. when scaffolding))
	// ig but this should be done in the desync branch instead lol - DataM0del
	// 	addModification("if(h.reset){this.setPosition(h.x,h.y,h.z),this.reset();return}", "", true);
	// 	addModification("this.serverDistance=y", `
	// if (h.reset) {
	// 	if (this.serverDistance >= 4) {
	// 		this.setPosition(h.x, h.y, h.z);
	// 	} else {
	// 		ClientSocket.sendPacket(new SPacketPlayerInput({sequenceNumber: NaN, pos: new PBVector3(g)}));
	// 		ClientSocket.sendPacket(new SPacketPlayerInput({sequenceNumber: NaN, pos: new PBVector3({x: h.x + 8, ...h})}));
	// 	}
	// 	this.reset();
	// 	return;
	// }
	// `);

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

	// PlayerESP
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

	// LOGIN BYPASS (clean up by DataM0del and TheM1ddleM1n!)
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

	// COMMAND
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
			case ".panic":
				for(const [name, module] of Object.entries(modules)) module.setEnabled(false);
				game.chat.addChat({
					text: "Toggled off all modules!",
					color: "red"
				});
				return this.closeInput();
			case ".t":
			case ".toggle":
				if (args.length > 1) {
					const mName = args[1];
					const module = args.length > 1 && getModule(mName);
					if (module) {
						module.toggle();
						game.chat.addChat({
							text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
							color: module.enabled ? "lime" : "red"
						});
					}
					else if (mName == "all") {
						for(const [name, module] of Object.entries(modules)) module.toggle();
					}
				}
				return this.closeInput();
			case ".modules":
				chatString = "Module List\\n";
				const modulesByCategory = {};
				for(const [name, module] of Object.entries(modules)) {
					if (!modulesByCategory[module.category]) modulesByCategory[module.category] = [];
					modulesByCategory[module.category].push(name);
				}
				for(const [category, moduleNames] of Object.entries(modulesByCategory)) {
					chatString += "\\n\\n" + category + ":";
					for (const moduleName of moduleNames) {
						chatString += "\\n" + moduleName;
					}
				}
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
			case ".report": {
				if (typeof globalThis.${storeName} === "undefined") globalThis.${storeName} = {};
				globalThis.${storeName}.openReportModal = function() {
					const GITHUB_REPO = "progmem-cc/miniblox.impact.client.updatedv2";
					
					// Exit pointer lock when opening modal
					if (document.pointerLockElement) {
						document.exitPointerLock();
					}
					
					const modal = document.createElement("div");
					modal.style.cssText = \`
						position: fixed;
						top: 0;
						left: 0;
						width: 100%;
						height: 100%;
						background: rgba(0, 0, 0, 0.75);
						display: flex;
						align-items: center;
						justify-content: center;
						z-index: 10000;
					\`;
					
					const form = document.createElement("div");
					form.style.cssText = \`
						background: #1a1a2e;
						border-radius: 8px;
						padding: 28px;
						width: 500px;
						max-width: 90%;
						box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
						border: 2px solid #2a2a3e;
					\`;
					
					const title = document.createElement("h2");
					title.textContent = "Report Issue";
					title.style.cssText = \`
						margin: 0 0 20px 0;
						color: #fff;
						font-size: 22px;
						font-weight: 600;
					\`;
					
					const typeLabel = document.createElement("label");
					typeLabel.textContent = "Type";
					typeLabel.style.cssText = \`
						display: block;
						color: #bbb;
						margin-bottom: 6px;
						font-size: 13px;
						font-weight: 500;
					\`;
					
					const typeSelect = document.createElement("select");
					typeSelect.innerHTML = \`
						<option value="bug">🐛 Bug Report</option>
						<option value="feature">✨ Feature Request</option>
					\`;
					typeSelect.style.cssText = \`
						width: 100%;
						padding: 10px 12px;
						margin-bottom: 18px;
						background: #252538;
						border: 2px solid #3a3a4e;
						border-radius: 6px;
						color: #fff;
						font-size: 15px;
						box-sizing: border-box;
						cursor: pointer;
						outline: none;
						appearance: none;
						background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
						background-repeat: no-repeat;
						background-position: right 10px center;
						background-size: 18px;
						padding-right: 40px;
					\`;
					typeSelect.onfocus = () => typeSelect.style.borderColor = "#0FB3A0";
					typeSelect.onblur = () => typeSelect.style.borderColor = "#3a3a4e";
					
					const titleLabel = document.createElement("label");
					titleLabel.textContent = "Title";
					titleLabel.style.cssText = \`
						display: block;
						color: #bbb;
						margin-bottom: 6px;
						font-size: 13px;
						font-weight: 500;
					\`;
					
					const titleInput = document.createElement("input");
					titleInput.type = "text";
					titleInput.placeholder = "Brief description of the issue";
					titleInput.style.cssText = \`
						width: 100%;
						padding: 10px 12px;
						margin-bottom: 18px;
						background: #252538;
						border: 2px solid #3a3a4e;
						border-radius: 6px;
						color: #fff;
						font-size: 14px;
						box-sizing: border-box;
						outline: none;
					\`;
					titleInput.onfocus = () => titleInput.style.borderColor = "#0FB3A0";
					titleInput.onblur = () => titleInput.style.borderColor = "#3a3a4e";
					
					const descLabel = document.createElement("label");
					descLabel.textContent = "Description";
					descLabel.style.cssText = \`
						display: block;
						color: #bbb;
						margin-bottom: 6px;
						font-size: 13px;
						font-weight: 500;
					\`;
					
					const descInput = document.createElement("textarea");
					descInput.placeholder = "Detailed description...\\n\\nFor bugs:\\n• Steps to reproduce\\n• Expected behavior\\n• Actual behavior\\n\\nFor features:\\n• What problem does it solve?\\n• How should it work?";
					descInput.rows = 10;
					descInput.style.cssText = \`
						width: 100%;
						padding: 10px 12px;
						margin-bottom: 20px;
						background: #252538;
						border: 2px solid #3a3a4e;
						border-radius: 6px;
						color: #fff;
						font-size: 14px;
						resize: vertical;
						font-family: inherit;
						box-sizing: border-box;
						outline: none;
					\`;
					descInput.onfocus = () => descInput.style.borderColor = "#0FB3A0";
					descInput.onblur = () => descInput.style.borderColor = "#3a3a4e";
					
					const buttonContainer = document.createElement("div");
					buttonContainer.style.cssText = \`
						display: flex;
						gap: 10px;
						justify-content: flex-end;
					\`;
					
					const cancelBtn = document.createElement("button");
					cancelBtn.textContent = "Cancel";
					cancelBtn.style.cssText = \`
						padding: 10px 20px;
						background: #2a2a3e;
						border: 2px solid #3a3a4e;
						border-radius: 6px;
						color: #fff;
						cursor: pointer;
						font-size: 14px;
						font-weight: 600;
						outline: none;
					\`;
					cancelBtn.onmouseover = () => cancelBtn.style.background = "#353548";
					cancelBtn.onmouseout = () => cancelBtn.style.background = "#2a2a3e";
					cancelBtn.onclick = () => {
						modal.remove();
						// Re-request pointer lock when closing modal
						if (game?.canvas) {
							game.canvas.requestPointerLock();
						}
					};
					
					const submitBtn = document.createElement("button");
					submitBtn.textContent = "Open in GitHub";
					submitBtn.style.cssText = \`
						padding: 10px 20px;
						background: #0FB3A0;
						border: none;
						border-radius: 6px;
						color: #fff;
						cursor: pointer;
						font-size: 14px;
						font-weight: 700;
						outline: none;
					\`;
					submitBtn.onmouseover = () => submitBtn.style.background = "#0d9a88";
					submitBtn.onmouseout = () => submitBtn.style.background = "#0FB3A0";
					submitBtn.onclick = () => {
						const issueTitle = titleInput.value.trim();
						if (!issueTitle) {
							titleInput.style.borderColor = "#ff4444";
							titleInput.placeholder = "Title is required!";
							return;
						}
						
						const issueType = typeSelect.value;
						const label = issueType === "bug" ? "bug" : "enhancement";
						const prefix = issueType === "bug" ? "[Bug]" : "[Feature]";
						const fullTitle = \`\${prefix} \${issueTitle}\`;
						
						const body = descInput.value.trim() || "No description provided.";
						const versionInfo = \`\\n\\n---\\n**Version:** \${VERSION}\\n**User Agent:** \${navigator.userAgent}\`;
						const fullBody = body + versionInfo;
						
						const url = \`https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/issues/new?labels=\${label}&title=\${encodeURIComponent(fullTitle)}&body=\${encodeURIComponent(fullBody)}\`;
						
						window.open(url, "_blank");
						modal.remove();
						// Re-request pointer lock when closing modal
						if (game?.canvas) {
							game.canvas.requestPointerLock();
						}
					};
					
					buttonContainer.appendChild(cancelBtn);
					buttonContainer.appendChild(submitBtn);
					
					form.appendChild(title);
					form.appendChild(typeLabel);
					form.appendChild(typeSelect);
					form.appendChild(titleLabel);
					form.appendChild(titleInput);
					form.appendChild(descLabel);
					form.appendChild(descInput);
					form.appendChild(buttonContainer);
					
					modal.appendChild(form);
					modal.onclick = (e) => {
						if (e.target === modal) {
							modal.remove();
							// Re-request pointer lock when closing modal
							if (game?.canvas) {
								game.canvas.requestPointerLock();
							}
						}
					};
					
					document.body.appendChild(modal);
					titleInput.focus();
				};
				
				globalThis.${storeName}.openReportModal();
				return this.closeInput();
			}
			case ".scriptmanager": {
				if (!modules["ScriptManager"].enabled) {
					modules["ScriptManager"].toggle();
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

	// ANTIBLIND
	addModification("player.isPotionActive(Potions.blindness)", 'player.isPotionActive(Potions.blindness) && !enabledModules["AntiBlind"]', true);

	// MAIN
	addModification('document.addEventListener("contextmenu",m=>m.preventDefault());', /*js*/`
		// my code lol
		(function() {
			class Module {
				name;
				func;
				enabled = false;
				bind = "";
				options = {};
				/** @type {() => string | undefined} */
				tagGetter = () => undefined;
				category;
				constructor(name, func, category, tag = () => undefined) {
					this.name = name;
					this.func = func;
					this.enabled = false;
					this.bind = "";
					this.options = {};
					this.tagGetter = tag;
					this.category = category;
					modules[this.name] = this;
				}
				toggle() {
					this.setEnabled(!this.enabled);
				}
				setEnabled(enabled) {
					this.enabled = enabled;
					enabledModules[this.name] = enabled;
					this.func(enabled);
				}
				get tag() {
					return this.tagGetter();
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
					// ! the last item in the option array should never be changed.
					// ! because it is used in the .reset command
					this.options[name] = [typee, defaultt, name, defaultt];
					return this.options[name];
				}
			}

			// === Custom Scripts Storage ===
			if (typeof globalThis.${storeName} === "undefined") globalThis.${storeName} = {};
			const customScripts = {};
			globalThis.${storeName}.customScripts = customScripts;
			
			function saveCustomScripts() {
				const scriptsData = Object.entries(customScripts).map(([name, data]) => ({
					name: name,
					code: data.code,
					source: data.source
				}));
				localStorage.setItem("impact_custom_scripts", JSON.stringify(scriptsData));
			}
			
			function loadCustomScripts() {
				try {
					const saved = localStorage.getItem("impact_custom_scripts");
					if (saved) {
						const scriptsData = JSON.parse(saved);
						scriptsData.forEach(script => {
							executeCustomScript(script.name, script.code, script.source, false);
						});
					}
				} catch (e) {
					console.error("Failed to load custom scripts:", e);
				}
			}
			
			function executeCustomScript(name, code, source, save = true) {
				try {
					// Try to remove the old module if it exists.
					if (modules[name]) {
						if (modules[name].enabled) modules[name].toggle();
						delete modules[name];
						delete enabledModules[name];
					}
					
					// To get the existing module names before execution
					const existingModules = new Set(Object.keys(modules));
					
					// Simply eval the code in the same scope
					eval(code);
					
					// Find the newly created modules
					const newModules = Object.keys(modules).filter(m => !existingModules.has(m));
					console.log("New modules created:", newModules);
					
					// Store script data with the actual module names
					customScripts[name] = { 
						code, 
						source,
						moduleNames: newModules // Store the actual module names
					};
					
					if (save) saveCustomScripts();
					
					// Update ClickGUI category if needed
					if (typeof globalThis.${storeName}.updateScriptsCategory === 'function') {
						globalThis.${storeName}.updateScriptsCategory();
					}
					
					return true;
				} catch (e) {
					console.error("Failed to execute script:", e);
					console.error("Script name:", name);
					console.error("Script code:", code);
					alert("Script error: " + e.message + "\\n\\nCheck console for details.");
					return false;
				}
			}
			
			function deleteCustomScript(name) {
				if (modules[name]) {
					if (modules[name].enabled) modules[name].toggle();
					delete modules[name];
					delete enabledModules[name];
				}
				delete customScripts[name];
				saveCustomScripts();
				
				// Update Scripts category
				if (typeof globalThis.${storeName}.updateScriptsCategory === 'function') {
					globalThis.${storeName}.updateScriptsCategory();
				}
			}
			
			function duplicateCustomScript(name) {
				if (!customScripts[name]) return null;
				
				let newName = name + "-2";
				let counter = 2;
				while (customScripts[newName]) {
					counter++;
					newName = name + "-" + counter;
				}
				
				const original = customScripts[name];
				executeCustomScript(newName, original.code, original.source + " (copy)");
				return newName;
			}

			let clickDelay = Date.now();
			new Module("AutoClicker", function(callback) {
				if (callback) {
					tickLoop["AutoClicker"] = function() {
					if (clickDelay < Date.now() && playerControllerDump.key.rightClick) {
							playerControllerDump.rightClick();
							clickDelay = Date.now() + 51;
					} else {
					if (playerControllerDump.objectMouseOver.block) return;
						if (clickDelay < Date.now() && playerControllerDump.key.leftClick && !player.isUsingItem()) {
							playerControllerDump.leftClick();
							clickDelay = Date.now() + 51;
						}
					}
					}
				} else delete tickLoop["AutoClicker"];
			}, "Combat");
			
			new Module("AntiBlind", function() {}, "Render");
			
			new Module("AntiCheat", function(callback) {
				if (!callback)
					return; // TODO: deinitialization logic
				const entities = game.world.entitiesDump;
				for (const entity of entities) {
						if (!entity instanceof EntityPlayer)
							continue; // only go through players
						if (entity.mode.isCreative() || entity.mode.isSpectator())
							continue; // ignore Albert einstein or someone who died
						// TODO: track the player's position and get the difference from previous position to new position.
				}
			}, "Broken");


            function reloadTickLoop(value) {
				if (game.tickLoop) {
					MSPT = value;
					clearInterval(game.tickLoop);
					game.tickLoop = setInterval(() => game.fixedUpdate(), MSPT);
				}
			}

			new Module("Sprint", function() {}, "Movement");
			const velocity = new Module("Velocity", function() {}, "Combat", () => \`\${velocityhori[1]}% \${velocityvert[1]}%\`);
			velocityhori = velocity.addoption("Horizontal", Number, 0);
			velocityvert = velocity.addoption("Vertical", Number, 0);
   
			// NoFall BETA
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
			},"Movement",() => "Packet");
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
	 				// this will force desync off even if fly is on, but I'm too lazy to make an entire priority system.
	  				// or something just to fix the 0 uses of fly while you're on the ground.
	 				else if (player.onGround && shouldDesync && desync) desync = false;
	  				shouldDesync = !player.onGround && player.motionY < -0.6 && player.fallDistance >= 2.5;
				};
			},"Movement",() => "Desync");

			// WTap
			new Module("WTap", function() {}, "Movement",() => "Packet");

			// AntiVoid
			new Module("AntiVoid", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["AntiVoid"] = function() {
        				const ray = rayTraceBlocks(player.getEyePos(), player.getEyePos().clone().setY(0), false, false, false, game.world);
						if (!ray) {
							player.motion.y = 0;
						}
					};
				}
				else delete tickLoop["AntiVoid"];
			}, "Movement",() => "Ignore");

			const criticals = new Module("Criticals", () => {}, () => "Packet");
			criticals.toggle();

			// this is a very old crash method,
			// bread (one of the devs behind atmosphere) found it
			// and later shared it to me when we were talking
			// about the upcoming bloxd layer. ooh.

			let serverCrasherStartX, serverCrasherStartZ;
			let serverCrasherPacketsPerTick;
			// if I recall, each chunk is 16 blocks or something.
			// maybe we can get vector's servers to die by sending funny values or something idk.
			const SERVER_CRASHER_CHUNK_XZ_INCREMENT = 16;
			const serverCrasher = new Module("ServerCrasher", cb => {
				if (cb) {
					let x = serverCrasherStartX[1];
					let z = serverCrasherStartZ[1];
					tickLoop["ServerCrasher"] = function() {
						for (let _ = 0; _ < serverCrasherPacketsPerTick[1]; _++) {
							x += SERVER_CRASHER_CHUNK_XZ_INCREMENT;
							z += SERVER_CRASHER_CHUNK_XZ_INCREMENT;
							ClientSocket.sendPacket(new SPacketRequestChunk({
								x,
								z
							}));
						}
					}
				} else {
					delete tickLoop["ServerCrasher"];
				}
			}, "Exploit", () => "Spam Chunk Load");
			
			serverCrasherStartX = serverCrasher.addoption("Start X", Number, 99e9);
			serverCrasherStartZ = serverCrasher.addoption("Start Z", Number, 99e9);
			serverCrasherPacketsPerTick = serverCrasher.addoption("Packets Per Tick", Number, 16);

			/** y offset values, that when used before attacking a player, gives a critical hit! **/
			const CRIT_OFFSETS = [
				0.08, -0.07840000152
			];

			/** call this before sending a use entity packet to attack. this makes the player crit **/
			function crit(when = criticals.enabled && player.onGround) {
				if (!when) {
					return;
				}

				for (const offset of CRIT_OFFSETS) {
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

			// Killaura!
			let attackDelay = Date.now();
			let didSwing = false;
			let attacked = 0;
			let attackedPlayers = {};
			let boxMeshes = [];
			let killaurarange, killaurablock, killaurabox, killauraangle, killaurawall, killauraitem;
			let killauraSwitchDelay;

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
						if ((attackedPlayers[entity.id] ?? 0) < Date.now())
							attackedPlayers[entity.id] = Date.now() + killauraSwitchDelay[1];
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
							crit();
						}

						sendYaw = false;
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
			}, "Combat", () => "Ignore");

			let killAuraAttackInvisible;
			let attackList = [];

			function findTarget(range = 6, angle = 360) {
				const localPos = controls.position.clone();
				const localTeam = getTeam(player);
				const entities = game.world.entitiesDump;

				const sqRange = range * range;
				const entities2 = Array.from(entities.values());

				const targets = entities2.filter(e => {
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

				return targets;
			}
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

						attackList = findTarget(killaurarange[1], killauraangle[1]);

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
			}, "Combat", () => \`\${killaurarange[1]} block\${killaurarange[1] == 1 ? "" : "s"} \${killaurablock[1] ? "Auto Block" : ""}\`);
			killaurarange = killaura.addoption("Range", Number, 6);
			killauraangle = killaura.addoption("Angle", Number, 360);
			killaurablock = killaura.addoption("AutoBlock", Boolean, true);
			killaurawall = killaura.addoption("Wallcheck", Boolean, false);
			killaurabox = killaura.addoption("Box", Boolean, true);
			killauraitem = killaura.addoption("LimitToSword", Boolean, false);
			killAuraAttackInvisible = killaura.addoption("AttackInvisbles", Boolean, true);
			killauraSwitchDelay = killaura.addoption("SwitchDelay", Number, 100);
			
			new Module("FastBreak", function() {}, "Client",() => "Client-Side");

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

			// OP_Fly
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
			},"Movement",() => "Desync");
			flybypass = fly.addoption("Bypass", Boolean, true);
			flyvalue = fly.addoption("Speed", Number, 0.18);
			flyvert = fly.addoption("Vertical", Number, 0.3);


			// InfinityFly
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
			}, "Movement",  () => \`V \${infiniteFlyVert[1]} \${infiniteFlyLessGlide[1] ? "LessGlide" : "MoreGlide"}\`);
			infiniteFlyVert = infiniteFly.addoption("Vertical", Number, 0.15);
			infiniteFlyLessGlide = infiniteFly.addoption("LessGlide", Boolean, true);

			new Module("InvWalk", function() {},"Movement", () => "Ignore");
			new Module("KeepSprint", function() {},"Movement", () => "Ignore");
			new Module("NoSlowdown", function() {},"Combat", () => "Ignore");

// WSpeed
let speedvalue, speedjump, speedauto, speedbypass;

const speed = new Module("Speed", function(callback) {
	if (!callback) {
		delete tickLoop["Speed"];
		desync = false; // disable desync when off
		return;
	}

	desync = speedbypass[1]; // enable desync flag if bypass is on

	let lastjump = 10;
	tickLoop["Speed"] = function() {
		lastjump++;

		const oldMotion = new Vector3$1(player.motion.x, 0, player.motion.z);
		const dir = getMoveDirection(Math.max(oldMotion.length(), speedvalue[1]));
		lastjump = player.onGround ? 0 : lastjump;

		// Base motion
		player.motion.x = dir.x;
		player.motion.z = dir.z;

		// Auto-jump
		const doJump = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space");
		if (doJump) {
			player.jump();
			player.motion.y = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space")
				? speedjump[1]
				: player.motion.y;
		}
	};
}, function() {
	return "V " + speedvalue[1] + " J " + speedjump[1] + " " + (speedauto[1] ? "A" : "M");
},"Movement",() => "Packet");

// Options
speedbypass = speed.addoption("Bypass", Boolean, true);
speedvalue = speed.addoption("Speed", Number, 0.39);
speedjump = speed.addoption("JumpHeight", Number, 0.42);
speedauto = speed.addoption("AutoJump", Boolean, true);

			const step = new Module("Step", function() {}, "Player", () => \`\${stepheight[1]}\`);
			stepheight = step.addoption("Height", Number, 0.5);


			new Module("ESP", function() {}, "Render",() => "Highlight");
			const textgui = new Module("TextGUI", function() {}, "Render");
			textguifont = textgui.addoption("Font", String, "Poppins");
			textguisize = textgui.addoption("TextSize", Number, 15);
			textguishadow = textgui.addoption("Shadow", Boolean, true);
			textgui.toggle();
			new Module("AutoRespawn", function() {});

			// === Script Manager Module ===
			let scriptManagerUI = null;
			new Module("ScriptManager", function(enabled) {
				if (enabled) {
					if (document.pointerLockElement) document.exitPointerLock();
					
					// Close ClickGUI if open
					if (typeof categoryPanel !== "undefined" && categoryPanel) {
						categoryPanel.remove();
						categoryPanel = null;
					}
					if (typeof modulePanels !== "undefined") {
						Object.values(modulePanels).forEach(p => p.remove());
						modulePanels = {};
					}
					if (typeof settingsPanel !== "undefined" && settingsPanel) {
						settingsPanel.remove();
						settingsPanel = null;
					}
					
					openScriptManagerUI();
				} else {
					closeScriptManagerUI();
					if (game?.canvas) game.canvas.requestPointerLock();
				}
			},"Client");

			function openScriptManagerUI() {
				if (scriptManagerUI) return;
				
				const modal = document.createElement("div");
				modal.style.cssText = \`
					position: fixed;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background: rgba(0, 0, 0, 0.75);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 10000;
				\`;
				
				const container = document.createElement("div");
				container.style.cssText = \`
					background: #1a1a2e;
					border-radius: 8px;
					padding: 24px;
					width: 700px;
					max-width: 90%;
					max-height: 80vh;
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
					border: 2px solid #2a2a3e;
					display: flex;
					flex-direction: column;
				\`;
				
				const title = document.createElement("h2");
				title.textContent = "Script Manager";
				title.style.cssText = \`
					margin: 0 0 20px 0;
					color: #fff;
					font-size: 22px;
					font-weight: 600;
				\`;
				
				const addButtonsContainer = document.createElement("div");
				addButtonsContainer.style.cssText = \`
					display: flex;
					gap: 8px;
					margin-bottom: 16px;
				\`;
				
				const addFileBtn = createButton("📁 Load File", () => {
					const input = document.createElement("input");
					input.type = "file";
					input.accept = ".js";
					input.onchange = (e) => {
						const file = e.target.files[0];
						if (file) {
							const reader = new FileReader();
							reader.onload = (ev) => {
								const name = file.name.replace(".js", "");
								const result = executeCustomScript(name, ev.target.result, "file: " + file.name);
								if (result) {
									if (typeof game !== 'undefined' && game?.chat) {
										game.chat.addChat({text: "Loaded script: " + name, color: "lime"});
									}
									refreshScriptList();
								} else {
									alert("Failed to load script: " + name + "\\nCheck console for errors.");
								}
							};
							reader.readAsText(file);
						}
					};
					input.click();
				});
				
				const addURLBtn = createButton("🌐 Load URL", () => {
					const url = prompt("Enter script URL:");
					if (url) {
						fetch(url)
							.then(r => r.text())
							.then(code => {
								const name = url.split("/").pop().replace(".js", "");
								const result = executeCustomScript(name, code, "url: " + url);
								if (result) {
									if (typeof game !== 'undefined' && game?.chat) {
										game.chat.addChat({text: "Loaded script: " + name, color: "lime"});
									}
									refreshScriptList();
								} else {
									alert("Failed to load script: " + name + "\\nCheck console for errors.");
								}
							})
							.catch(e => {
								alert("Failed to load URL: " + e.message);
							});
					}
				});
				
				const addCodeBtn = createButton("✏️ Write Code", () => {
					openCodeEditor();
				});
				
				addButtonsContainer.appendChild(addFileBtn);
				addButtonsContainer.appendChild(addURLBtn);
				addButtonsContainer.appendChild(addCodeBtn);
				
				const scriptList = document.createElement("div");
				scriptList.style.cssText = \`
					flex: 1;
					overflow-y: auto;
					margin-bottom: 16px;
					border: 2px solid #2a2a3e;
					border-radius: 6px;
					padding: 8px;
					background: #252538;
				\`;
				
				function refreshScriptList() {
					scriptList.innerHTML = "";
					
					// Update Scripts category in ClickGUI
					if (typeof globalThis.${storeName}.updateScriptsCategory === 'function') {
						globalThis.${storeName}.updateScriptsCategory();
					}
					
					Object.entries(customScripts).forEach(([name, data]) => {
						const item = document.createElement("div");
						item.style.cssText = \`
							background: #2a2a3e;
							border: 2px solid #3a3a4e;
							border-radius: 6px;
							padding: 12px;
							margin-bottom: 8px;
							display: flex;
							justify-content: space-between;
							align-items: center;
						\`;
						
						const info = document.createElement("div");
						info.style.cssText = "flex: 1;";
						
						const nameEl = document.createElement("div");
						nameEl.textContent = name;
						nameEl.style.cssText = "color: #fff; font-weight: 600; margin-bottom: 4px;";
						
						const sourceEl = document.createElement("div");
						sourceEl.textContent = data.source;
						sourceEl.style.cssText = "color: #888; font-size: 12px;";
						
						info.appendChild(nameEl);
						info.appendChild(sourceEl);
						
						const actions = document.createElement("div");
						actions.style.cssText = "display: flex; gap: 6px;";
						
						const dupBtn = createSmallButton("📋", () => {
							const newName = duplicateCustomScript(name);
							if (newName) {
								if (typeof game !== 'undefined' && game?.chat) {
									game.chat.addChat({text: "Duplicated: " + newName, color: "lime"});
								}
								refreshScriptList();
							}
						});
						
						const delBtn = createSmallButton("🗑️", () => {
							if (confirm("Delete script: " + name + "?")) {
								deleteCustomScript(name);
								if (typeof game !== 'undefined' && game?.chat) {
									game.chat.addChat({text: "Deleted: " + name, color: "yellow"});
								}
								refreshScriptList();
							}
						});
						
						actions.appendChild(dupBtn);
						actions.appendChild(delBtn);
						
						item.appendChild(info);
						item.appendChild(actions);
						scriptList.appendChild(item);
					});
					
					if (Object.keys(customScripts).length === 0) {
						const empty = document.createElement("div");
						empty.textContent = "No custom scripts loaded";
						empty.style.cssText = "color: #666; text-align: center; padding: 20px;";
						scriptList.appendChild(empty);
					}
				}
				
				const closeBtn = createButton("Close", () => {
					modules["ScriptManager"].toggle();
				});
				closeBtn.style.width = "100%";
				
				container.appendChild(title);
				container.appendChild(addButtonsContainer);
				container.appendChild(scriptList);
				container.appendChild(closeBtn);
				modal.appendChild(container);
				
				modal.onclick = (e) => {
					if (e.target === modal) modules["ScriptManager"].toggle();
				};
				
				document.body.appendChild(modal);
				scriptManagerUI = modal;
				refreshScriptList();
			}
			
			function closeScriptManagerUI() {
				if (scriptManagerUI) {
					scriptManagerUI.remove();
					scriptManagerUI = null;
				}
			}
			
			function openCodeEditor(editName = null, editCode = "") {
				const modal = document.createElement("div");
				modal.style.cssText = \`
					position: fixed;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background: rgba(0, 0, 0, 0.85);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 10001;
				\`;
				
				const editor = document.createElement("div");
				editor.style.cssText = \`
					background: #1a1a2e;
					border-radius: 8px;
					padding: 24px;
					width: 800px;
					max-width: 90%;
					max-height: 90vh;
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
					border: 2px solid #2a2a3e;
					display: flex;
					flex-direction: column;
				\`;
				
				const editorTitle = document.createElement("h3");
				editorTitle.textContent = editName ? "Edit Script" : "New Script";
				editorTitle.style.cssText = "margin: 0 0 16px 0; color: #fff; font-size: 18px;";
				
				const nameInput = document.createElement("input");
				nameInput.type = "text";
				nameInput.placeholder = "Script name";
				nameInput.value = editName || "";
				nameInput.style.cssText = \`
					width: 100%;
					padding: 10px 12px;
					margin-bottom: 12px;
					background: #252538;
					border: 2px solid #3a3a4e;
					border-radius: 6px;
					color: #fff;
					font-size: 14px;
					box-sizing: border-box;
					outline: none;
				\`;
				
				const codeArea = document.createElement("textarea");
				codeArea.placeholder = "// Write your script here\\n// Example:\\nnew Module('MyModule', function(enabled) {\\n  if (enabled) {\\n    tickLoop['MyModule'] = function() {\\n      // Your code here\\n      console.log(player.pos);\\n    };\\n  } else {\\n    delete tickLoop['MyModule'];\\n  }\\n});";
				codeArea.value = editCode;
				codeArea.style.cssText = \`
					width: 100%;
					height: 400px;
					padding: 12px;
					margin-bottom: 16px;
					background: #252538;
					border: 2px solid #3a3a4e;
					border-radius: 6px;
					color: #fff;
					font-size: 13px;
					font-family: 'Courier New', monospace;
					resize: vertical;
					box-sizing: border-box;
					outline: none;
				\`;
				
				const btnContainer = document.createElement("div");
				btnContainer.style.cssText = "display: flex; gap: 10px; justify-content: flex-end;";
				
				const cancelBtn = createButton("Cancel", () => modal.remove());
				const saveBtn = createButton("Save & Load", () => {
					const name = nameInput.value.trim();
					const code = codeArea.value.trim();
					if (!name) {
						alert("Please enter a script name");
						return;
					}
					if (!code) {
						alert("Please enter script code");
						return;
					}
					const result = executeCustomScript(name, code, "custom code");
					if (result) {
						if (typeof game !== 'undefined' && game?.chat) {
							game.chat.addChat({text: "Loaded script: " + name, color: "lime"});
						}
						modal.remove();
						// Trigger refresh by reopening Script Manager
						if (modules["ScriptManager"]) {
							modules["ScriptManager"].toggle();
							setTimeout(() => modules["ScriptManager"].toggle(), 100);
						}
					} else {
						alert("Failed to load script: " + name + "\\nCheck console for errors.");
					}
				});
				saveBtn.style.background = "#0FB3A0";
				
				btnContainer.appendChild(cancelBtn);
				btnContainer.appendChild(saveBtn);
				
				editor.appendChild(editorTitle);
				editor.appendChild(nameInput);
				editor.appendChild(codeArea);
				editor.appendChild(btnContainer);
				modal.appendChild(editor);
				
				modal.onclick = (e) => {
					if (e.target === modal) modal.remove();
				};
				
				document.body.appendChild(modal);
				nameInput.focus();
			}
			
			function createButton(text, onclick) {
				const btn = document.createElement("button");
				btn.textContent = text;
				btn.style.cssText = \`
					padding: 10px 16px;
					background: #2a2a3e;
					border: 2px solid #3a3a4e;
					border-radius: 6px;
					color: #fff;
					cursor: pointer;
					font-size: 14px;
					font-weight: 600;
					outline: none;
				\`;
				btn.onmouseover = () => btn.style.background = "#353548";
				btn.onmouseout = () => btn.style.background = "#2a2a3e";
				btn.onclick = onclick;
				return btn;
			}
			
			function createSmallButton(text, onclick) {
				const btn = document.createElement("button");
				btn.textContent = text;
				btn.style.cssText = \`
					padding: 6px 10px;
					background: #2a2a3e;
					border: 2px solid #3a3a4e;
					border-radius: 4px;
					color: #fff;
					cursor: pointer;
					font-size: 14px;
					outline: none;
				\`;
				btn.onmouseover = () => btn.style.background = "#353548";
				btn.onmouseout = () => btn.style.background = "#2a2a3e";
				btn.onclick = onclick;
				return btn;
			}
			
			// Load saved scripts on startup
			setTimeout(() => loadCustomScripts(), 1000);

			const blockHandlers = {
				rightClick(pos) {
					ClientSocket.sendPacket(new SPacketClick({
						location: pos
					}));
				},
				breakBlock(pos) {
					ClientSocket.sendPacket(new SPacketBreakBlock({
						location: pos,
						start: false
					}));
				}
			};

			function isAir(b) {
				return b instanceof BlockAir;
			}
			function isSolid(b) {
				return b.material.isSolid();
			}
			const dfltFilter = b => isSolid(b);

			function handleInRange(range, filter = dfltFilter, handler = blockHandlers.rightClick) {
				const min = new BlockPos(player.pos.x - range, player.pos.y - range, player.pos.z - range);
				const max = new BlockPos(player.pos.x + range, player.pos.y + range, player.pos.z + range);
				const blocks = BlockPos.getAllInBoxMutable(min, max);
				const filtered = filter !== undefined ? blocks.filter(b => {
					return filter(game.world.getBlock(b));
				}) : blocks;
				filtered.forEach(handler);
				return filtered;
			}

			// Breaker
			let breakerrange;
			const breaker = new Module("Breaker", function(callback) {
				if (callback) {
					tickLoop["Breaker"] = function() {
						if (breakStart > Date.now()) return;
						let offset = breakerrange[1];
						handleInRange(breakerrange[1], b => b instanceof BlockDragonEgg);
					}
				}
				else delete tickLoop["Breaker"];
			}, "Minigames", () => \`\${breakerrange[1]} block\${breakerrange[1] == 1 ? "" : "s"}\`);
			breakerrange = breaker.addoption("Range", Number, 10);

			// Nuker
			// TODO: fix kick from sending too many packets at once,
			// and also to fix for when the break time isn't instant.
			let nukerRange;
			const nuker = new Module("Nuker", function(callback) {
				if (callback) {
					tickLoop["Nuker"] = function() {
						let offset = nukerRange[1];
						handleInRange(nukerRange[1], undefined, blockHandlers.breakBlock);
					}
				}
				else delete tickLoop["Nuker"];
			}, "World", () => \`\${nukerRange[1]} block\${nukerRange[1] == 1 ? "" : "s"}\`);
			nukerRange = nuker.addoption("Range", Number, 5);

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
			}, "Player");

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
			}, "Misc");

			
            // ChestSteal
			let cheststealblocks, cheststealtools;
const cheststeal = new Module("ChestSteal", function(callback) {
    if (callback) {
        let lastContainer = null;
        tickLoop["ChestSteal"] = function() {
            if (
                player.openContainer &&
                player.openContainer instanceof ContainerChest &&
                player.openContainer !== lastContainer
            ) {
                lastContainer = player.openContainer;
                // Instantly steal items and close the GUI before it becomes visible
                for(let i = 0; i < player.openContainer.numRows * 9; i++) {
                    const slot = player.openContainer.inventorySlots[i];
                    const item = slot.getHasStack() ? slot.getStack().getItem() : null;
                    if (item && (
                        item instanceof ItemSword ||
                        item instanceof ItemArmor ||
                        item instanceof ItemAppleGold ||
                        (cheststealblocks[1] && item instanceof ItemBlock) ||
                        (cheststealtools[1] && item instanceof ItemTool)
                    )) {
                        playerControllerDump.windowClickDump(player.openContainer.windowId, i, 0, 1, player);
                    }
                }
                player.closeScreen();
            }
            // Reset lastContainer when chest GUI is closed
            if (!player.openContainer && lastContainer) lastContainer = null;
        }
    } else {
        delete tickLoop["ChestSteal"];
    };
}, "World", () => \`\${cheststealblocks[1] ? "B: Y" : "B: N"} \${cheststealtools[1] ? "T: Y" : "T: N"}\`);
cheststealblocks = cheststeal.addoption("Blocks", Boolean, true);
cheststealtools = cheststeal.addoption("Tools", Boolean, true);

           // Scaffold :)
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

const scaffold = new Module("Scaffold", function(callback) {
    if (callback) {
        if (player) oldHeld = game.info.selectedSlot;

        game.chat.addChat({
    text: "funny bypass.",
    color: "royalblue"
});

        tickLoop["Scaffold"] = function() {
            tickCount++;

            // Auto-select blocks & cycle between them
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

                    break; // Stop checks after placing.
                }
            }
        };
    } else {
        if (player && oldHeld !== undefined) {
            switchSlot(oldHeld);
        }
        delete tickLoop["Scaffold"];
    }
}, "World");

scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);

            // Timer
			let timervalue;
			const timer = new Module("Timer", function(callback) {
				reloadTickLoop(callback ? 50 / timervalue[1] : 50);
			}, "World", () => \`\${timervalue[1]} MSPT\`);
			timervalue = timer.addoption("Value", Number, 1.2);
			new Module("Phase", function() {}, "World");

			const antiban = new Module("AntiBan", function() {}, "Misc", () => useAccountGen[1] ? "Gen" : "Non Account");
			useAccountGen = antiban.addoption("AccountGen", Boolean, false);
			accountGenEndpoint = antiban.addoption("GenServer", String, "http://localhost:8000/generate");
			antiban.toggle();
			new Module("AutoRejoin", function() {}, "Misc");
			new Module("AutoQueue", function() {}, "Minigames");
			new Module("AutoVote", function() {}, "Minigames");
			const chatdisabler = new Module("ChatDisabler", function() {}, "Misc", () => "Spam");
			chatdisablermsg = chatdisabler.addoption("Message", String, "Your src code suc\\\\ks");
			new Module("FilterBypass", function() {}, "Exploit", () => "\\\\");
   
    // InvCleaner
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
}, "Player");

function dropSlot(index) {
    const windowId = player.openContainer.windowId;
    playerControllerDump.windowClickDump(windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(windowId, -999, 0, 0, player);
}

// AutoFunnyChat
var killMessages = [
     "☠️ {name} couldn’t survive the wrath of ✦ IMPACT V6 ✦",
    "⚡ {name} got deleted — IMPACT V6 never lags.",
    "🔥 {name} folded instantly — IMPACT V6 ON TOP.",
    "💀 R.I.P {name} — system overloaded by IMPACT V6.",
    "✪ {name} tried to fight perfection. IMPACT V6 responded.",
    "🚀 {name} launched straight to respawn courtesy of IMPACT V6.",
    "⚙️ Calculated. Executed. {name} eliminated by IMPACT V6.",
    "💥 Boom! {name} couldn’t handle the force of IMPACT V6.",
    "🏆 Victory secured. {name} was just another demo target.",
    "🔧 {name} broke under optimized pressure (IMPACT V6).",
    "🧠 {name} got out-thought, out-aimed, out-classed.",
    "❌ {name} = error. IMPACT V6 = success.",
    "⚡ IMPACT V6 outpaced {name} by light-years.",
    "💫 {name} met the meta — and the meta won.",
    "🔥 IMPACT V6 activated. {name} disintegrated.",
    "⛔ Access denied, {name}. IMPACT V6 firewall engaged.",
    "💎 Another flawless execution — goodbye {name}.",
    "🕹️ GG {name}, but IMPACT V6 plays on expert mode.",
    "💀 {name} forgot rule #1: Don’t challenge IMPACT V6.",
    "⚔️ Outplayed, outclassed, outlasted — {name} destroyed.",
    "🌐 IMPACT V6 connected. {name} disconnected.",
    "🔥 {name} evaporated under precision fire.",
    "⚙️ Advanced algorithms say: {name} = loser.",
    "💢 IMPACT V6 just rewrote {name}’s respawn code.",
    "🚨 Critical hit! {name} eliminated with style.",
    "⚡ Frame-perfect execution on {name}.",
    "♻️ {name} recycled into experience points.",
    "💣 {name} detonated by IMPACT V6.",
    "🔮 {name} predicted defeat, couldn’t avoid it.",
    "💀 System log: {name} — user terminated.",
    "⚡ Fast reflexes? Not enough, {name}.",
    "🔥 {name} entered the killzone of IMPACT V6.",
    "☢️ Danger: {name} exposed to high-impact energy.",
    "🧩 {name} didn’t fit the puzzle. Removed by IMPACT V6.",
    "⚔️ Duel complete — {name} eliminated cleanly.",
    "📉 {name}’s K/D ratio just dropped hard.",
    "🛠️ Patch note: {name} no longer a threat.",
    "⚙️ Efficiency 100%. {name} 0%.",
    "💀 {name} deleted by advanced targeting system.",
    "✨ Another one for the highlight reel. RIP {name}.",
    "⚡ Instant replay: {name} got obliterated.",
    "🔥 {name} ran diagnostics — result: IMPACT V6 superiority.",
    "🧠 IMPACT V6 calculated every frame. {name} didn’t.",
    "💀 End of line, {name}.",
    "⚡ Shockwave detected — source: IMPACT V6.",
    "🔥 Execution complete. {name} neutralized.",
    "♛ IMPACT V6 reigns supreme. {name} dethroned."
];

const autoFunnyChatConfig = {
    killCooldown: 5000,
    minDelay: 500,
    maxDelay: 1500,
    avoidRepeat: true,
    maxHistorySize: 5
};

const autofunnychat = new Module("autofunnychat", function(callback) {
    if (!callback) {
        // Cleanup when disabled
        if (window.__autoFunnyKillMsgListener) {
            if (ClientSocket && ClientSocket.socket && ClientSocket.socket.off) {
                ClientSocket.socket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
            }
            window.__autoFunnyKillMsgListener = null;
        }
        if (window.__autoFunnyState) {
            window.__autoFunnyState = null;
        }
        return;
    }
    
    // Initialize state
    if (!window.__autoFunnyState) {
        window.__autoFunnyState = {
            lastKillSent: 0,
            messageHistory: []
        };
    }
    
    const state = window.__autoFunnyState;
    
    // Helper: Get random message (avoiding recent ones)
    function getRandomMessage(victimName) {
        let availableMessages = killMessages;
        
        if (autoFunnyChatConfig.avoidRepeat && state.messageHistory.length > 0) {
            availableMessages = killMessages.filter(msg => 
                !state.messageHistory.includes(msg)
            );
            
            if (availableMessages.length === 0) {
                state.messageHistory = [];
                availableMessages = killMessages;
            }
        }
        
        let msg = availableMessages[Math.floor(Math.random() * availableMessages.length)];
        
        if (victimName) {
            msg = msg.replace(/{name}/g, victimName);
        }
        
        state.messageHistory.push(msg);
        if (state.messageHistory.length > autoFunnyChatConfig.maxHistorySize) {
            state.messageHistory.shift();
        }
        
        return msg;
    }
    
    // Helper: Send message with rate limiting
    function sendFunnyMessage(victimName) {
        const now = Date.now();
        
        if (now - state.lastKillSent < autoFunnyChatConfig.killCooldown) {
            return false;
        }
        
        const msg = getRandomMessage(victimName);
        if (ClientSocket && ClientSocket.sendPacket) {
            ClientSocket.sendPacket(new SPacketMessage({text: msg}));
        }
        
        state.lastKillSent = now;
        return true;
    }
    
    // Remove old listener if exists
    if (window.__autoFunnyKillMsgListener && ClientSocket && ClientSocket.socket && ClientSocket.socket.off) {
        ClientSocket.socket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
    }
    
    // Create new listener
    window.__autoFunnyKillMsgListener = function(h) {
        if (!h || !h.text || !player) return;
        
        let victimName = null;
        
        // "You eliminated [name]"
        if (h.text.includes("You eliminated")) {
            const match = h.text.match(/You eliminated (.+?)(?:\.|$|,)/);
            if (match) victimName = match[1].trim().replace(/White/gi, '');
        }
        // "You knocked out [name]"
        else if (h.text.includes("You knocked out")) {
            const match = h.text.match(/You knocked out (.+?)(?:\.|$|,)/);
            if (match) victimName = match[1].trim().replace(/White/gi, '');
        }
        // "You sent [name]"
        else if (h.text.includes("You sent")) {
            const match = h.text.match(/You sent (.+?)(?:\.|$|,)/);
            if (match) victimName = match[1].trim().replace(/White/gi, '');
        }
        // "[name] was eliminated by [your name]"
        else if (h.text.includes("eliminated by") && h.text.includes(player.name)) {
            const match = h.text.match(/(.+?) (?:was )?eliminated by/);
            if (match) victimName = match[1].trim().replace(/White/gi, '');
        }
        // "[your name] eliminated [name]"
        else if (h.text.includes(player.name + " eliminated")) {
            const match = h.text.match(new RegExp(player.name + " eliminated (.+?)(?:\\.|$|,)"));
            if (match) victimName = match[1].trim().replace(/White/gi, '');
        }
        
        if (victimName) {
            const delay = autoFunnyChatConfig.minDelay + 
                Math.random() * (autoFunnyChatConfig.maxDelay - autoFunnyChatConfig.minDelay);
            
            setTimeout(function() {
                sendFunnyMessage(victimName);
            }, delay);
        }
    };
    
    // Register listener
    if (ClientSocket && ClientSocket.socket && ClientSocket.socket.on) {
        ClientSocket.socket.on("CPacketMessage", window.__autoFunnyKillMsgListener);
    }
}, "Combat");

// Jesus
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
}, "Movement");

// Longjump
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
            player.motion.y = 0.42; // vanilla jump power
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
}, "Movement");

// Options
ljpower  = longjump.addoption("Power", Number, 0.6);   // horizontal boost
ljboost  = longjump.addoption("BoostTicks", Number, 10); // how long boost lasts
ljdesync = longjump.addoption("Desync", Boolean, true);  // toggle desync mode

const survival = new Module("SurvivalMode", function(callback) {
				if (callback) {
					if (player) player.setGamemode(GameMode.fromId("survival"));
					survival.toggle();
				}
			}, "Misc", () => "Spoof");

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
		const scripts = [];
		// Update Scripts category dynamically
		store.updateScriptsCategory = function () {
			try {
				const scripts = store.customScripts || {};
				Object.values(scripts).forEach(script => {
					if (script.moduleNames && script.moduleNames.length > 0) {
						script.moduleNames.forEach(modName => {
							scripts.push(modName.toLowerCase());
						});
					}
				});
				
				console.log("Updating Scripts category:", scripts);
				
				if (scripts.length > 0) {
					
					// Recreate category panel if it exists
					if (categoryPanel) {
						const oldPanel = categoryPanel;
						categoryPanel = null;
						oldPanel.remove();
						categoryPanel = createCategoryPanel();
						document.body.appendChild(categoryPanel);
					}
				} else {
					scripts.clear();
				}
			} catch (e) {
				console.error("Failed to update Scripts category:", e);
			}
		};

		// === Vape V4 Styles ===
		const style = document.createElement("style");
		style.textContent = `
      @keyframes vapeEnter {0%{opacity:0;transform:translateY(-10px);}100%{opacity:1;transform:translateY(0);}}
      @keyframes vapeExit {0%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-10px);}}
      @keyframes glowPulse {0%{box-shadow:0 2px 8px rgba(15,179,160,0);}50%{box-shadow:0 4px 16px rgba(15,179,160,0.4);}100%{box-shadow:0 2px 8px rgba(15,179,160,0);}}
      .vape-panel { position:absolute; background:linear-gradient(180deg, rgba(28,30,32,0.98), rgba(23,25,27,0.98)); border-radius:12px; border:1px solid rgba(255,255,255,0.06); box-shadow:0 12px 30px rgba(0,0,0,0.7); backdrop-filter:blur(8px); font-family:Inter,system-ui,sans-serif; color:#E6E9EA; animation:vapeEnter .2s ease-out; z-index:100000; overflow:hidden; min-width:260px; }
      .vape-panel.closing { animation:vapeExit .2s ease-out; }
      .vape-header { padding:12px 14px; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.04); font-weight:700; font-size:13px; letter-spacing:0.5px; cursor:move; user-select:none; display:flex; align-items:center; justify-content:space-between; }
      .vape-content { padding:8px; max-height:500px; overflow-y:auto; overflow-x:hidden; transition:max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease; }
      .vape-content.collapsing { max-height:0; opacity:0; padding-top:0; padding-bottom:0; }
      .vape-content::-webkit-scrollbar { width:6px; }
      .vape-content::-webkit-scrollbar-thumb { background:var(--vape-accent, #0FB3A0); border-radius:10px; }
      .vape-content::-webkit-scrollbar-track { background:transparent; }
      .vape-cat-item { display:flex; align-items:center; gap:10px; padding:10px 12px; margin:4px 0; border-radius:8px; cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); user-select:none; border:1px solid transparent; }
      .vape-cat-item:hover { background:linear-gradient(90deg,var(--vape-accent-alpha, rgba(15,179,160,0.08)),transparent); box-shadow:0 4px 12px var(--vape-accent-shadow, rgba(15,179,160,0.15)); }
      .vape-cat-item.active { background:linear-gradient(90deg,var(--vape-accent-alpha, rgba(15,179,160,0.12)),transparent); border:1px solid var(--vape-accent-alpha, rgba(15,179,160,0.12)); }
      .vape-cat-icon { width:18px; height:18px; border-radius:4px; background:linear-gradient(135deg,var(--vape-accent, #0FB3A0),var(--vape-accent, #13a695)); box-shadow:0 2px 6px var(--vape-accent-shadow, rgba(15,179,160,0.2)); transition:all 0.3s ease; }
      .vape-cat-item:hover .vape-cat-icon { box-shadow:0 4px 12px var(--vape-accent-shadow, rgba(15,179,160,0.4)); transform:scale(1.05); }
      .vape-cat-text { font-weight:600; font-size:13px; }
      .vape-module-row { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; margin:4px 0; border-radius:8px; background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent); border:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position:relative; }
      .vape-module-row::after { content:''; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:0; height:2px; background:var(--vape-accent, #0FB3A0); transition:width 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius:2px; }
      .vape-module-row:hover::after { width:90%; }
      .vape-module-row:hover { background:linear-gradient(180deg,rgba(255,255,255,0.05),var(--vape-accent-alpha, rgba(15,179,160,0.03))); box-shadow:0 8px 24px var(--vape-accent-shadow, rgba(15,179,160,0.25)); transform:translateY(-2px); }
      .vape-module-left { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
      .vape-module-icon { width:32px; height:32px; border-radius:6px; background:linear-gradient(135deg,#2b2d30,#131415); display:flex; align-items:center; justify-content:center; color:#8F9498; font-weight:700; font-size:12px; flex-shrink:0; }
      .vape-module-title { font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .vape-module-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .vape-toggle { width:42px; height:22px; border-radius:20px; background:rgba(255,255,255,0.05); position:relative; transition:all 0.18s; cursor:pointer; flex-shrink:0; }
      .vape-toggle.on { background:var(--vape-accent, #0FB3A0); }
      .vape-toggle-knob { position:absolute; left:3px; top:3px; width:16px; height:16px; border-radius:50%; background:#0d0f10; box-shadow:0 4px 10px rgba(0,0,0,0.6); transition:all 0.18s; }
      .vape-toggle.on .vape-toggle-knob { left:23px; background:white; }
      .vape-bind-display { font-size:11px; color:#8F9498; margin-right:8px; min-width:30px; text-align:right; flex-shrink:0; }
      .vape-settings-row { margin:8px 0; }
      .vape-settings-label { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:12px; }
      .vape-settings-value { color:#8F9498; }
      .vape-slider { width:100%; height:6px; border-radius:999px; background:rgba(255,255,255,0.08); outline:none; appearance:none; }
      .vape-slider::-webkit-slider-thumb { appearance:none; width:16px; height:16px; border-radius:50%; background:var(--vape-accent, #0FB3A0); box-shadow:0 6px 12px rgba(0,0,0,0.4); cursor:pointer; }
      .vape-bind-row { padding:8px 10px; margin:4px 0; background:rgba(0,0,0,0.2); border-radius:6px; font-size:12px; color:#8F9498; }
      .vape-bind-change { color:#0FB3A0; cursor:pointer; margin-left:8px; }
      .vape-bind-change:hover { text-decoration:underline; }
      .vape-options { display:none; flex-direction:column; gap:4px; padding:8px 12px; background:rgba(0,0,0,0.3); border-top:1px solid rgba(255,255,255,0.05); animation:vapeEnter .2s ease-out; }
      .vape-options.show { display:flex; }
      .vape-options label { font-size:12px; display:flex; justify-content:space-between; color:white; }
      .vape-options input[type="text"], .vape-options input[type="range"] { flex:1; margin-left:4px; }
      .notif-wrap { position:fixed; bottom:40px; right:30px; display:flex; flex-direction:column; align-items:flex-end; pointer-events:none; z-index:999999; }
      .notif { display:flex; align-items:center; gap:8px; background:rgba(20,20,20,0.85); color:white; padding:10px 14px; margin-top:8px; border-radius:10px; font-family:Inter,system-ui,sans-serif; font-size:13px; backdrop-filter:blur(6px); box-shadow:0 4px 12px rgba(0,0,0,0.4); opacity:1; transform:translateX(120%); transition:opacity .3s, transform .3s ease; border-left:4px solid; }
      .notif.info { border-color:#3498db; }
      .notif.success { border-color:#2ecc71; }
      .notif.warn { border-color:#f1c40f; }
      .notif.error { border-color:#e74c3c; }
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

		// === Vape V4 GUI State ===
		let categoryPanel = null;
		let modulePanels = {};
		let settingsPanel = null;
		let selectedCategory = null;
		let bindingModule = null;

		// === Save/Load GUI State ===
		function saveGUIState() {
			const openPanels = Object.keys(modulePanels);
			localStorage.setItem("vape-gui-open-panels", JSON.stringify(openPanels));
		}

		function loadGUIState() {
			const saved = localStorage.getItem("vape-gui-open-panels");
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (e) {
					return [];
				}
			}
			return [];
		}

		// === Helper: Set Accent Color ===
		function setAccentColor(color) {
			document.documentElement.style.setProperty("--vape-accent", color);
			// Convert hex to rgba for alpha variants
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			document.documentElement.style.setProperty("--vape-accent-alpha", `rgba(${r},${g},${b},0.12)`);
			document.documentElement.style.setProperty("--vape-accent-shadow", `rgba(${r},${g},${b},0.2)`);
			// Save to localStorage
			localStorage.setItem("vape-accent-color", color);
		}

		// Load saved accent color
		const savedColor = localStorage.getItem("vape-accent-color");
		if (savedColor) {
			setAccentColor(savedColor);
		}

		// === Helper: Create draggable panel ===
		function createPanel(title, x, y, width, showCollapseButton = false) {
			const panel = document.createElement("div");
			panel.className = "vape-panel";
			panel.style.position = "absolute";

			// Load saved position if exists
			const savedPos = localStorage.getItem("vape-panel-pos-" + title);
			if (savedPos) {
				const pos = JSON.parse(savedPos);
				panel.style.left = pos.left;
				panel.style.top = pos.top;
			} else {
				panel.style.left = x + "px";
				panel.style.top = y + "px";
			}
			panel.style.width = width + "px";

			const header = document.createElement("div");
			header.className = "vape-header";

			const titleSpan = document.createElement("span");
			titleSpan.textContent = title;
			titleSpan.style.flex = "1";
			header.appendChild(titleSpan);

			const content = document.createElement("div");
			content.className = "vape-content";
			panel.appendChild(header);
			panel.appendChild(content);

			// Add collapse button if requested
			if (showCollapseButton) {
				const collapseBtn = document.createElement("div");
				collapseBtn.className = "vape-collapse-btn";
				collapseBtn.textContent = "−";
				collapseBtn.style.cssText = "width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:16px;font-weight:700;transition:all 0.2s;user-select:none;";
				collapseBtn.title = "Collapse";

				// Load saved collapse state
				let isCollapsed = localStorage.getItem("vape-panel-collapsed-" + title) === "true";

				if (isCollapsed) {
					content.classList.add("collapsing");
					collapseBtn.textContent = "+";
				}

				collapseBtn.onmouseenter = () => collapseBtn.style.background = "rgba(255,255,255,0.1)";
				collapseBtn.onmouseleave = () => collapseBtn.style.background = "rgba(255,255,255,0.05)";
				collapseBtn.onclick = (e) => {
					e.stopPropagation();
					isCollapsed = !isCollapsed;
					if (isCollapsed) {
						content.classList.add("collapsing");
						collapseBtn.textContent = "+";
					} else {
						content.classList.remove("collapsing");
						collapseBtn.textContent = "−";
					}
					localStorage.setItem("vape-panel-collapsed-" + title, isCollapsed);
				};

				header.appendChild(collapseBtn);
			}

			// Dragging
			let dragging = false, offsetX, offsetY;
			const onMouseDown = (e) => {
				if (e.target.classList.contains("vape-collapse-btn")) return;
				dragging = true;
				offsetX = e.clientX - panel.offsetLeft;
				offsetY = e.clientY - panel.offsetTop;
				panel.style.zIndex = "100001";
			};
			const onMouseMove = (e) => {
				if (!dragging) return;
				panel.style.left = (e.clientX - offsetX) + "px";
				panel.style.top = (e.clientY - offsetY) + "px";
			};
			const onMouseUp = () => {
				if (!dragging) return;
				dragging = false;
				panel.style.zIndex = "100000";
				localStorage.setItem("vape-panel-pos-" + title, JSON.stringify({
					left: panel.style.left,
					top: panel.style.top
				}));
			};
			header.addEventListener("mousedown", onMouseDown);
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);

			return { panel, content };
		}

		// === Create Category Panel ===
		function createCategoryPanel() {
			const { panel, content } = createPanel("Impact V6", 40, 40, 220);
			const baseCategories = ["Combat", "Movement", "Player", "Render", "World","Client","Minigames", "Misc","Exploit","Broken"];
			const categories = [...baseCategories];

			if (scripts > 0) {
				console.log("Adding Scripts category!");
				categories.push("Scripts");
			}

			categories.push("Settings");
			console.log("Final categories:", categories);

			categories.forEach(cat => {
				const item = document.createElement("div");
				item.className = "vape-cat-item";
				item.dataset.category = cat;

				const icon = document.createElement("div");
				icon.className = "vape-cat-icon";

				const text = document.createElement("span");
				text.className = "vape-cat-text";
				text.textContent = cat;

				item.appendChild(icon);
				item.appendChild(text);
				content.appendChild(item);

				item.addEventListener("click", () => {
					if (cat === "Settings") {
						openSettingsPanel();
					} else {
						openModulePanel(cat);
					}
					updateCategoryHighlights();
				});
			});

			return panel;
		}

		// === Update category highlights based on open panels ===
		function updateCategoryHighlights() {
			if (!categoryPanel) return;
			const items = categoryPanel.querySelectorAll(".vape-cat-item");
			items.forEach(item => {
				const cat = item.dataset.category;
				if (modulePanels[cat]) {
					item.classList.add("active");
				} else {
					item.classList.remove("active");
				}
			});
		}

		// === Create Module Row ===
function createModuleRow(name, mod, content) {
    const row = document.createElement("div");
    row.className = "vape-module-row";

    const left = document.createElement("div");
    left.className = "vape-module-left";

    const icon = document.createElement("div");
    icon.className = "vape-module-icon";
    icon.textContent = name[0];

    const title = document.createElement("div");
    title.className = "vape-module-title";
    title.textContent = name;

    left.appendChild(icon);
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "vape-module-right";

    // Bind display - FIXED VERSION!
    const bindDisplay = document.createElement("span");
    bindDisplay.className = "vape-bind-display";

    // FIXED: Check if module has a bind when creating the display
    if (mod.bind && mod.bind !== "") {
        bindDisplay.textContent = mod.bind.toUpperCase();
        bindDisplay.style.cssText = "font-size:10px;color:#E6E9EA;margin-right:8px;min-width:30px;text-align:center;flex-shrink:0;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:4px;font-weight:700;";
    } else {
        bindDisplay.textContent = "";
        bindDisplay.style.cssText = "font-size:10px;color:#E6E9EA;margin-right:8px;min-width:0;text-align:center;flex-shrink:0;";
    }

    const toggle = document.createElement("div");
    toggle.className = "vape-toggle" + (mod.enabled ? " on" : "");
    const knob = document.createElement("div");
    knob.className = "vape-toggle-knob";
    toggle.appendChild(knob);

    toggle.onclick = (e) => {
        e.stopPropagation();
        if (mod.toggle) {
            mod.toggle();
            toggle.classList.toggle("on", mod.enabled);
            showNotif(name + " " + (mod.enabled ? "enabled" : "disabled"), mod.enabled ? "success" : "error");
        }
    };

    right.appendChild(bindDisplay);
    right.appendChild(toggle);
    row.appendChild(left);
    row.appendChild(right);

    const optionsBox = document.createElement("div");
    optionsBox.className = "vape-options";
    optionsBox.style.display = "none";

    const toggleModule = (e) => {
        const t = e.target;
        if (t.tagName === "INPUT" || t.classList.contains("vape-toggle") ||
            t.classList.contains("vape-toggle-knob") || t.classList.contains("vape-bind-key-display") ||
            t.classList.contains("vape-slider")) return;
        if (mod.toggle) {
            mod.toggle();
            toggle.classList.toggle("on", mod.enabled);
            showNotif(name + " " + (mod.enabled ? "enabled" : "disabled"), mod.enabled ? "success" : "error");
        }
    };

    row.onclick = toggleModule;
    row.onmousedown = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            bindDisplay.textContent = "waiting...";
            bindDisplay.style.color = "#0FB3A0";
            bindingModule = { name, mod, bindDisplay };
        }
    };

    // Right click to show options
    row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const isVisible = optionsBox.style.display === "flex";
        optionsBox.style.display = isVisible ? "none" : "flex";

        // Populate options if first time
        if (!isVisible && optionsBox.children.length === 0) {
            // Bind display at top - FIXED VERSION
            const bindKeyDisplay = document.createElement("div");
            bindKeyDisplay.className = "vape-bind-key-display";

            // FIX: Show current bind or "CLICK TO BIND"
            if (mod.bind && mod.bind !== "") {
                bindKeyDisplay.textContent = mod.bind.toUpperCase();
                bindKeyDisplay.style.cssText = "background:rgba(255,255,255,0.08);padding:6px 12px;border-radius:6px;font-weight:700;font-size:11px;text-align:center;margin-bottom:8px;cursor:pointer;";
            } else {
                bindKeyDisplay.textContent = "CLICK TO BIND";
                bindKeyDisplay.style.cssText = "background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:6px;font-weight:700;font-size:11px;text-align:center;margin-bottom:8px;cursor:pointer;color:#8F9498;";
            }

            bindKeyDisplay.title = "Click to change bind";
            bindKeyDisplay.addEventListener("click", (e) => {
                e.stopPropagation();
                bindKeyDisplay.textContent = "WAITING...";
                bindKeyDisplay.style.background = "rgba(241,196,15,0.2)";
                bindKeyDisplay.style.color = "#f1c40f";
                bindingModule = { name, mod, bindDisplay, optionBindDisplay: bindKeyDisplay };
            });
            optionsBox.appendChild(bindKeyDisplay);

            // Module options
            if (mod.options) {
                Object.entries(mod.options).forEach(([key, opt]) => {
                    const [type, val, label] = opt;
                    const line = document.createElement("div");
                    line.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-top:8px;";

                    const labelSpan = document.createElement("span");
                    labelSpan.textContent = label || key;
                    labelSpan.style.cssText = "font-size:12px;color:#E6E9EA;";
                    line.appendChild(labelSpan);

                    if (type === Boolean) {
                        const optToggle = document.createElement("div");
                        optToggle.className = "vape-toggle" + (val ? " on" : "");
                        optToggle.style.cssText = "width:42px;height:22px;border-radius:20px;background:rgba(255,255,255,0.05);position:relative;transition:all 0.18s;cursor:pointer;flex-shrink:0;";
                        if (val) {
                            optToggle.style.background = "var(--vape-accent, #0FB3A0)";
                        }
                        const optKnob = document.createElement("div");
                        optKnob.className = "vape-toggle-knob";
                        optKnob.style.cssText = "position:absolute;left:" + (val ? "23px" : "3px") + ";top:3px;width:16px;height:16px;border-radius:50%;background:" + (val ? "white" : "#0d0f10") + ";box-shadow:0 4px 10px rgba(0,0,0,0.6);transition:all 0.18s;";
                        optToggle.appendChild(optKnob);
                        optToggle.addEventListener("click", (e) => {
                            e.stopPropagation();
                            opt[1] = !opt[1];
                            if (opt[1]) {
                                optToggle.style.background = "var(--vape-accent, #0FB3A0)";
                                optKnob.style.left = "23px";
                                optKnob.style.background = "white";
                            } else {
                                optToggle.style.background = "rgba(255,255,255,0.05)";
                                optKnob.style.left = "3px";
                                optKnob.style.background = "#0d0f10";
                            }
                        });
                        line.appendChild(optToggle);
                    } else if (type === Number) {
                        const sliderWrap = document.createElement("div");
                        sliderWrap.style.cssText = "flex:1;margin-left:12px;display:flex;align-items:center;gap:8px;max-width:150px;";

                        const slider = document.createElement("input");
                        slider.type = "range";
                        slider.className = "vape-slider";
                        const [min, max, step] = opt.range ?? [0, 10, 0.1];
                        slider.min = min;
                        slider.max = max;
                        slider.step = step;
                        slider.value = val;

                        const valueSpan = document.createElement("span");
                        valueSpan.textContent = val;
                        valueSpan.style.cssText = "color:#8F9498;font-size:11px;min-width:35px;text-align:right;font-weight:600;";

                        slider.addEventListener("click", (e) => e.stopPropagation());
                        slider.addEventListener("mousedown", (e) => e.stopPropagation());
                        slider.oninput = () => {
                            opt[1] = parseFloat(slider.value);
                            valueSpan.textContent = slider.value;
                        };

                        sliderWrap.appendChild(slider);
                        sliderWrap.appendChild(valueSpan);
                        line.appendChild(sliderWrap);
                    } else if (type === String) {
                        const input = document.createElement("input");
                        input.type = "text";
                        input.value = val;
                        input.style.cssText = "flex:1;margin-left:8px;max-width:150px;background:rgba(255,255,255,0.05);color:#E6E9EA;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 8px;font-size:12px;outline:none;";
                        input.addEventListener("click", (e) => e.stopPropagation());
                        input.addEventListener("focus", () => {
                            input.style.borderColor = "var(--vape-accent, #0FB3A0)";
                        });
                        input.addEventListener("blur", () => {
                            input.style.borderColor = "rgba(255,255,255,0.1)";
                        });
                        input.onchange = () => { opt[1] = input.value; };
                        line.appendChild(input);
                    }

                    optionsBox.appendChild(line);
                });
            }
        }
    });

    return { row, optionsBox };
}

		// === Close Panel with Animation ===
		function closePanelWithAnimation(panel, callback) {
			panel.classList.add("closing");
			setTimeout(() => {
				panel.remove();
				if (callback) callback();
			}, 200);
		}

		// === Open Module Panel ===
		function openModulePanel(category) {
			console.log("Opening module panel for category:", category);
			
			// Close if already open
			if (modulePanels[category]) {
				closePanelWithAnimation(modulePanels[category], () => {
					delete modulePanels[category];
					updateCategoryHighlights();
					saveGUIState();
				});
				return;
			}

			// Get modules for this category
			const modules = Object.values(store.modules).filter((mod) => mod.category == category);

			console.log("Filtered modules:", modules.length);

			if (modules.length === 0) {
				console.log("No modules found for category:", category);
				return;
			}

			// Position panels in a cascade
			const panelCount = Object.keys(modulePanels).length;
			const { panel, content } = createPanel(category.toUpperCase(), 280 + panelCount * 30, 40 + panelCount * 30, 260, true);
			modulePanels[category] = panel;
			document.body.appendChild(panel);

			modules.forEach((mod) => {
				const { name } = mod;
				const { row, optionsBox } = createModuleRow(name, mod, content);
				content.appendChild(row);
				content.appendChild(optionsBox);
			});

			updateCategoryHighlights();
			saveGUIState();
		}

		// === Open Settings Panel ===
		function openSettingsPanel() {
			// Close if already open
			if (modulePanels["Settings"]) {
				closePanelWithAnimation(modulePanels["Settings"], () => {
					delete modulePanels["Settings"];
					updateCategoryHighlights();
					saveGUIState();
				});
				return;
			}

			const { panel, content } = createPanel("SETTINGS", 280, 40, 300, true);
			modulePanels["Settings"] = panel;
			document.body.appendChild(panel);

			// Config Save/Load
			const saveConfigBtn = document.createElement("div");
			saveConfigBtn.className = "vape-module-row";
			saveConfigBtn.style.cursor = "pointer";
			saveConfigBtn.innerHTML = '<div class="vape-module-left"><div class="vape-module-icon">💾</div><div class="vape-module-title">Save Config</div></div>';
			saveConfigBtn.addEventListener("click", () => {
				const configName = prompt("Enter config name:", "default");
				if (configName) {
					globalThis[storeName].saveVapeConfig(configName);
					showNotif("Config saved: " + configName, "success");
				}
			});
			content.appendChild(saveConfigBtn);

			const loadConfigBtn = document.createElement("div");
			loadConfigBtn.className = "vape-module-row";
			loadConfigBtn.style.cursor = "pointer";
			loadConfigBtn.innerHTML = '<div class="vape-module-left"><div class="vape-module-icon">📂</div><div class="vape-module-title">Load Config</div></div>';
			loadConfigBtn.addEventListener("click", () => {
				const configName = prompt("Enter config name to load:", "default");
				if (configName) {
					globalThis[storeName].saveVapeConfig();
					globalThis[storeName].loadVapeConfig(configName);
					showNotif("Config loaded: " + configName, "success");
				}
			});
			content.appendChild(loadConfigBtn);

			// Reset Layout
			const resetLayoutBtn = document.createElement("div");
			resetLayoutBtn.className = "vape-module-row";
			resetLayoutBtn.style.cursor = "pointer";
			resetLayoutBtn.innerHTML = '<div class="vape-module-left"><div class="vape-module-icon">🔄</div><div class="vape-module-title">Reset Layout</div></div>';
			resetLayoutBtn.addEventListener("click", () => {
				if (confirm("Reset panel positions to default?")) {
					// Clear all saved positions
					Object.keys(localStorage).filter(k => k.startsWith("vape-panel-pos-")).forEach(k => {
						localStorage.removeItem(k);
					});
					// Close all panels and reopen category panel
					Object.values(modulePanels).forEach(p => p.remove());
					modulePanels = {};
					if (categoryPanel) categoryPanel.remove();
					categoryPanel = createCategoryPanel();
					document.body.appendChild(categoryPanel);
					showNotif("Layout reset!", "success");
				}
			});
			content.appendChild(resetLayoutBtn);

			// Accent Color Picker
			const colorRow = document.createElement("div");
			colorRow.className = "vape-module-row";
			colorRow.style.flexDirection = "column";
			colorRow.style.alignItems = "flex-start";
			colorRow.innerHTML = '<div class="vape-module-left" style="width:100%;margin-bottom:8px;"><div class="vape-module-icon">🎨</div><div class="vape-module-title">Accent Color</div></div>';

			const colorInput = document.createElement("input");
			colorInput.type = "color";
			colorInput.value = localStorage.getItem("vape-accent-color") || "#0FB3A0";
			colorInput.style.cssText = "width:100%;height:40px;border:none;border-radius:6px;cursor:pointer;background:transparent;";
			colorInput.addEventListener("change", (e) => {
				setAccentColor(e.target.value);
				showNotif("Accent color changed!", "success");
			});
			colorRow.appendChild(colorInput);
			content.appendChild(colorRow);

			// Reset Accent Color
			const resetColorBtn = document.createElement("div");
			resetColorBtn.className = "vape-module-row";
			resetColorBtn.style.cursor = "pointer";
			resetColorBtn.innerHTML = '<div class="vape-module-left"><div class="vape-module-icon">↩️</div><div class="vape-module-title">Reset Accent Color</div></div>';
			resetColorBtn.addEventListener("click", () => {
				setAccentColor("#0FB3A0");
				colorInput.value = "#0FB3A0";
				showNotif("Accent color reset!", "success");
			});
			content.appendChild(resetColorBtn);

			updateCategoryHighlights();
			saveGUIState();
		}



		// === Toggle ClickGUI ===
		let visible = false;
		document.addEventListener("keydown", (e) => {
			if (e.code === "Backslash") {
				visible = !visible;

				if (visible) {
					// Exit pointer lock when opening GUI
					if (document.pointerLockElement) {
						document.exitPointerLock();
					}

					// Show category panel
					if (categoryPanel) categoryPanel.remove();
					categoryPanel = createCategoryPanel();
					document.body.appendChild(categoryPanel);

					// Restore previously open panels
					const openPanels = loadGUIState();
					openPanels.forEach(panelName => {
						if (panelName === "Settings") {
							openSettingsPanel();
						} else {
							openModulePanel(panelName);
						}
					});
				} else {
					// Save state before closing
					saveGUIState();

					// Hide all panels with animation
					if (categoryPanel) {
						closePanelWithAnimation(categoryPanel, () => {
							categoryPanel = null;
						});
					}
					Object.entries(modulePanels).forEach(([key, panel]) => {
						closePanelWithAnimation(panel, () => {
							delete modulePanels[key];
						});
					});
					if (settingsPanel) {
						closePanelWithAnimation(settingsPanel, () => {
							settingsPanel = null;
						});
					}
					selectedCategory = null;

					// Re-request pointer lock when closing GUI
					if (game?.canvas) {
						game.canvas.requestPointerLock();
					}
				}
			}

			// Handle keybinding
			if (bindingModule) {
				if (e.code === "Escape") {
					// Unbind (set to empty)
					bindingModule.mod.setbind("");
					if (bindingModule.bindDisplay) {
						bindingModule.bindDisplay.textContent = "";
						bindingModule.bindDisplay.style.cssText = "font-size:10px;color:#E6E9EA;margin-right:8px;min-width:0;text-align:center;flex-shrink:0;";
					}
					if (bindingModule.optionBindDisplay) {
						bindingModule.optionBindDisplay.textContent = "CLICK TO BIND";
						bindingModule.optionBindDisplay.style.background = "rgba(255,255,255,0.05)";
						bindingModule.optionBindDisplay.style.color = "#8F9498";
					}
					bindingModule = null;
					showNotif("Bind removed", "info", 1000);
				} else {
					const key = e.code.toLowerCase().replace("key", "").replace("digit", "");
					if (key && bindingModule.mod.setbind) {
						bindingModule.mod.setbind(key);
						// Update both displays
						if (bindingModule.bindDisplay) {
							bindingModule.bindDisplay.textContent = key.toUpperCase();
							bindingModule.bindDisplay.style.cssText = "font-size:10px;color:#E6E9EA;margin-right:8px;min-width:30px;text-align:center;flex-shrink:0;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:4px;font-weight:700;";
						}
						if (bindingModule.optionBindDisplay) {
							bindingModule.optionBindDisplay.textContent = key.toUpperCase();
							bindingModule.optionBindDisplay.style.background = "rgba(255,255,255,0.08)";
							bindingModule.optionBindDisplay.style.color = "#E6E9EA";
						}
						showNotif("Bound " + bindingModule.name + " to " + key, "success", 2000);
						bindingModule = null;
					}
				}
			}
		});

		// === Startup notification ===
		setTimeout(() => { showNotif("Press \\\\ to open Impact V6 ClickGUI!", "info", 4000); }, 500);
	}
})();
