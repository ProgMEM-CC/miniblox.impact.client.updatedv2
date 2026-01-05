/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "6.9";

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
		addModification("}p.slot===Equipment_Slot.MAIN_HAND", "}" + /*js*/`
if (murderMystery.enabled) handleMurderMysteryHook(y, g);
p.slot===Equipment_Slot.MAIN_HAND
`, true);
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
	addModification('this.nameTag.visible=!this.entity.sneak&&!Options$1.streamerMode.value&&game.serverInfo.serverCategory!=="murder"', `
this.nameTag.visible = (tagsWhileSneaking[1] || !this.entity.sneak)
			&& !Options$1.streamerMode.value
			&& (tagsInMM[1] || game.serverInfo.serverCategory !== "murder");
`, true);
	addModification('Potions.jump.getId(),"5");', `
		const SERVICES_SERVER = new URL("https://imchat-server.vercel.app/");
		const SERVICES_SEND_ENDPOINT = new URL("/send", SERVICES_SERVER);
		let servicesName;
		const SERVICES_UNSET_NAME = "Unset name";
		/**
		 * Sends an IRC message to IMChat with our current player's username
		 * @param {string} message
		*/
		function sendIRCMessage(message) {
			const name = servicesName[1];
			if (name == SERVICES_UNSET_NAME) {
				game.chat.addChat({
					text: "Please set your nickname in the \`Services\` module in order to use IRC! (set it via ClickGUI)",
					color: "red"
				});
				game.chat.addChat({
					text: "You can also set your nickname via .setoption: .setoption Services Name <your nickname, surround with double quotes if it contains spaces>",
					color: "green"
				});
				return;
			}
			fetch(\`\${SERVICES_SEND_ENDPOINT}?author=\${name}&platformID=impact:client\`, {
				method: "POST",
				body: message
			}).then(async r => {
				if (!r.ok) {
					game.chat.addChat({
						text: \`Failed sending IRC message (response not OK): \${r.status} \${r.statusText} \${await r.text()}\`,
						color: "red"
					});
				}
			}).catch(r => {
				game.chat.addChat({
					text: \`Failed sending IRC message (server down?): \${r} \`,
					color: "red"
				});
			});
		}
		let showNametags, Services, murderMystery, tagsWhileSneaking, tagsInMM;
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
		function autoToggleShowNametagStuff() {
			if (!showNametags.enabled) {
				toast({
					title: "Turned on show nametags automatically",
					status: "success"
				});
				showNametags.setEnabled(true);
			}
			if (tagsInMM[1] !== true) {
				tagsInMM[1] = true;
				toast({title: "Turned on Murder Mystery setting in show nametags module" });
			}
		}

		function handleMurderMysteryHook(entity, currentItemStack) {
			const item = currentItemStack?.getItem();
			if (item === undefined)
				return;
			if (item instanceof ItemSword) {
				autoToggleShowNametagStuff();
				toast({
					title: \`\${entity.name} IS THE MURDERER!\`,
					status: "warning"
				});
				
				// Dynamic Island notification
				if (enabledModules["DynamicIsland"]) {
					const dynamicIsland = globalThis.${storeName}.dynamicIsland;
					const cleanName = entity.name.replace(/\\\\[a-z]+\\\\/g, '');
					dynamicIsland.show({
						duration: 4000,
						width: 300,
						height: 70,
						elements: [
							{ type: "text", content: "⚔️ Murderer Detected", x: 0, y: -15, color: "#ff4444", size: 14, bold: true },
							{ type: "text", content: cleanName, x: 0, y: 5, color: "#fff", size: 13, bold: true },
							{ type: "text", content: "Holding sword", x: 0, y: 22, color: "#888", size: 10 }
						]
					});
				}
			}
			if (item instanceof ItemBow) {
				autoToggleShowNametagStuff();
				toast({
					title: \`\${entity.name} has a bow.\`,
					color: "blue"
				});
				
				// Dynamic Island notification
				if (enabledModules["DynamicIsland"]) {
					const dynamicIsland = globalThis.${storeName}.dynamicIsland;
					const cleanName = entity.name.replace(/\\\\[a-z]+\\\\/g, '');
					dynamicIsland.show({
						duration: 4000,
						width: 300,
						height: 70,
						elements: [
							{ type: "text", content: "🏹 Bow Detected", x: 0, y: -15, color: "#0FB3A0", size: 14, bold: true },
							{ type: "text", content: cleanName, x: 0, y: 5, color: "#fff", size: 13, bold: true },
							{ type: "text", content: "Holding bow", x: 0, y: 22, color: "#888", size: 10 }
						]
					});
				}
			}
			console.log(\`\${entity.name} is holding\`, item);
		}
		async function generateAccount() {
			const dynamicIsland = globalThis.${storeName}.dynamicIsland;
			dynamicIsland.show({
				duration: 1.5e3,
				width: 250,
				height: 50,
				elements: [
					{ type: "text", content: "Generating account", x: 0, y: 0, size: 18 }
				]
			});
			const res = await fetch(accountGenEndpoint[1]);
			if (!res.ok)
				throw await res.text();
			const j = await res.json();
			dynamicIsland.show({
				duration: 1e3,
				width: 255,
				height: 45,
				elements: [
					{ type: "text", content: \`Generated account: \${j.name}\`, x: 0, y: 0, size: 18 }
				]
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
			// Show notification
			if (enabledModules["DynamicIsland"]) {
				const dynamicIsland = globalThis.${storeName}.dynamicIsland;
				dynamicIsland.show({
					duration: 2000,
					width: 260,
					height: 60,
					elements: [
						{ type: "text", content: "AutoRejoin", x: 0, y: -8, color: "#fff", size: 13, bold: true },
						{ type: "text", content: "Rejoining in 0.4s", x: 0, y: 12, color: "#888", size: 11 }
					]
				});
			}
			
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
			const dynamicIsland = globalThis.${storeName}.dynamicIsland;
			dynamicIsland.show({
				duration: 3e3,
				width: 330,
				height: 67,
				elements: [
					{ type: "text", content: "Voting for #2 (Overpowered)", x: 0, y: 0, size: 18 }
				]
			});
			// vote for option 2 (Overpowered)
			ClientSocket.sendPacket(new SPacketMessage({text: "/vote 2"}));
		}

		// console.info("Message (text and ID): ", h.text, h.id);

		if (h.text.endsWith("Press N to queue for the next game!") && h.id == undefined && enabledModules["AutoQueue"]) {
			const dynamicIsland = globalThis.${storeName}.dynamicIsland;
			dynamicIsland.show({
				duration: 1.55e3, // 1.55 seconds (e3 means 3 extra 0's)
				width: 370,
				height: 67,
				elements: [
					{ type: "text", content: "Queueing next game in 1.5 seconds", x: 0, y: 0, size: 18 }
				]
			});
			// I'd hope you could disable auto queue within 3 seconds if you want
			// so we have to check here too.
			setTimeout(() => {
				if (enabledModules["AutoQueue"]) game.requestQueue();
			}, 1.5e3);
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
			const [, vH] = velocityhori;
			const [, vV] = velocityvert;
			if (vH === 0 && vV === 0) return;
			// i.e. percentage = 100% => 1 or 50% => 0.5, and 50.5% => 0.505
			const pH = vH / 100;
			const pV = vV / 100;
			h.motion = new Vector3$1(h.motion.x * pH, h.motion.y * pV, h.motion.z * pH);
		}
	`);
	addModification('"CPacketExplosion",h=>{', `
		if (h.playerPos && enabledModules["Velocity"]) {
			const [, vH] = velocityhori;
			const [, vV] = velocityvert;
			if (vH === 0 && vV === 0) return;
			// i.e. percentage = 100% => 1 or 50% => 0.5, and 50.5% => 0.505
			const pH = vH / 100;
			const pV = vV / 100;
			if (velocityhori[1] == 0 && velocityvert[1] == 0) return;
			h.playerPos = new Vector3$1(h.playerPos.x * pH, h.playerPos.y * pV, h.playerPos.z * pH);
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
		`new SPacketLoginStart({
requestedUuid: undefined,
session: (enabledModules["AntiBan"]
	? useAccountGen[1]
		? (await generateAccount()).session
		: ""
	: (localStorage.getItem(SESSION_TOKEN_KEY) ?? "")),
hydration: "0",
metricsId: uuid$1(),
clientVersion: VERSION$1
})`,
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
						for(const [name, module] of Object.entries(modules)) module.toggleSilently();
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
			// .chat / ; for IRC
			case ".chat":
			case ";":
				if (!Services.enabled) {
					game.chat.addChat({text:
						"Please enable Services before trying to use IRC!"
					});
					return this.closeInput();
				}
				args.shift();
				const msg = args.join(" ");
				sendIRCMessage(msg);
				return this.closeInput();
				
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
					modules["ScriptManager"].toggleSilently();
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
		(async function() {
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
				/** toggles the module without i.e. the notifications */
				toggleSilently() {
					this.setEnabled(!this.enabled);
				}
				/** toggles to notification and shows the dynamic island if DynamicIsland */
				toggle() {
					this.toggleSilently();
					// Show Dynamic Island on toggle
					if (enabledModules["DynamicIsland"]) {
						moduleToggleDisplay.show(this.name, this.enabled);
					}
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

			// === Dynamic Island System ===
			let dynamicIslandElement = null;
			let dynamicIslandContent = null;
			let dynamicIslandTimeout = null;
			let dynamicIslandCurrentRequest = null;
			let dynamicIslandDefaultDisplay = null;
			let dynamicIslandUpdateInterval = null;

			const dynamicIsland = {
				show(request) {
					if (!dynamicIslandElement) return;

					// Clear existing timeout
					if (dynamicIslandTimeout) clearTimeout(dynamicIslandTimeout);

					// Check if content is the same (avoid unnecessary re-render)
					const requestKey = JSON.stringify(request);
					if (this.lastRequestKey === requestKey) return;
					this.lastRequestKey = requestKey;

					// Store current request
					dynamicIslandCurrentRequest = request;

					// Update size
					dynamicIslandElement.style.width = request.width + "px";
					dynamicIslandElement.style.height = request.height + "px";
					
					// Store dimensions for coordinate conversion
					this.currentWidth = request.width;
					this.currentHeight = request.height;
					
					// Render elements
					this.renderElements(request.elements);
					
					// Set timeout to return to default
					if (request.duration > 0) {
						dynamicIslandTimeout = setTimeout(() => {
							this.hide();
						}, request.duration);
					}
				},
				
				hide() {
					if (dynamicIslandTimeout) clearTimeout(dynamicIslandTimeout);
					dynamicIslandCurrentRequest = null;
					if (dynamicIslandDefaultDisplay) {
						this.show(dynamicIslandDefaultDisplay);
					}
				},
				
				renderElements(elements) {
					if (!dynamicIslandContent) return;

					// Clear existing content
					dynamicIslandContent.innerHTML = "";

					// Render each element
					for (const element of elements) {
						const el = this.createElement(element);
						if (el) dynamicIslandContent.appendChild(el);
					}
				},

				createElement(element) {
					const el = document.createElement("div");
					el.style.position = "absolute";
					el.style.left = element.x + "px";
					el.style.top = element.y + "px";

					switch (element.type) {
						case "text":
							return this.createTextElement(element);
						case "progress":
							return this.createProgressElement(element);
						case "toggle":
							return this.createToggleElement(element);
						case "image":
							return this.createImageElement(element);
					}
					return null;
				},

				createTextElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const el = document.createElement("div");
					el.style.cssText = \`
						position: absolute;
						left: \${centerX + element.x}px;
						top: \${centerY + element.y}px;
						color: \${element.color || "#fff"};
						font-size: \${element.size || 14}px;
						font-weight: \${element.bold ? "bold" : "normal"};
						white-space: nowrap;
						transform: translate(-50%, -50%);
						\${element.shadow ? "text-shadow: 1px 1px 2px rgba(0,0,0,0.8);" : ""}
					\`;
					el.textContent = element.content;
					return el;
				},
				
				createProgressElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const container = document.createElement("div");
					container.style.cssText = \`
						position: absolute;
						left: \${centerX + element.x}px;
						top: \${centerY + element.y}px;
						width: \${element.width}px;
						height: \${element.height}px;
						background: \${element.bgColor || "#333"};
						border-radius: \${element.rounded ? (element.height / 2) + "px" : "0"};
						overflow: hidden;
						transform: translate(-50%, -50%);
					\`;
					
					const bar = document.createElement("div");
					bar.style.cssText = \`
						width: \${element.value * 100}%;
						height: 100%;
						background: \${element.color || "#0FB3A0"};
						transition: width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
					\`;
					
					container.appendChild(bar);
					return container;
				},
				
				createToggleElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const size = element.size || 30;
					const container = document.createElement("div");
					container.style.cssText = \`
						position: absolute;
						left: \${centerX + element.x}px;
						top: \${centerY + element.y}px;
						width: \${size * 1.8}px;
						height: \${size}px;
						background: \${element.state ? "#0FB3A0" : "#555"};
						border-radius: \${size / 2}px;
						transition: background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
						transform: translate(-50%, -50%);
					\`;
					
					const circle = document.createElement("div");
					const circleSize = size * 0.8;
					circle.style.cssText = \`
						width: \${circleSize}px;
						height: \${circleSize}px;
						background: #fff;
						border-radius: 50%;
						position: absolute;
						top: \${(size - circleSize) / 2}px;
						left: \${element.state ? (size * 1.8 - circleSize - (size - circleSize) / 2) : ((size - circleSize) / 2)}px;
						transition: left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
						box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					\`;
					
					// Handle animation flag
					if (element.animate) {
						// Start from opposite state
						circle.style.left = element.state ? ((size - circleSize) / 2) + "px" : (size * 1.8 - circleSize - (size - circleSize) / 2) + "px";
						// Trigger animation immediately after render
						requestAnimationFrame(() => {
							circle.style.left = element.state ? (size * 1.8 - circleSize - (size - circleSize) / 2) + "px" : ((size - circleSize) / 2) + "px";
						});
					}
					
					container.appendChild(circle);
					return container;
				},
				
				createImageElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const img = document.createElement("img");
					img.style.cssText = \`
						position: absolute;
						left: \${centerX + element.x}px;
						top: \${centerY + element.y}px;
						width: \${element.width}px;
						height: \${element.height}px;
						transform: translate(-50%, -50%);
					\`;
					img.src = typeof element.src === "string" ? element.src : element.src.src;
					return img;
				},
				
				updateVariables() {
					// No longer needed, but kept for compatibility
				}
			};

			// Module toggle display system
			const moduleToggleDisplay = {
				show(moduleName, enabled) {
					dynamicIsland.show({
						duration: 1000,
						width: 300,
						height: 60,
						elements: [
							{ type: "text", content: moduleName, x: 10, y: -8, color: "#fff", size: 18, bold: true },
							{ type: "text", content: enabled ? "ENABLED" : "DISABLED", x: 10, y: 12, 
								color: enabled ? "#0FB3A0" : "#ff4444", size: 12, bold: true },
							{ type: "toggle", state: enabled, x: -100, y: 0, size: 30, animate: true }
						]
					});
				}
			};

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
						if (modules[name].enabled) modules[name].toggleSilently();
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
					if (modules[name].enabled) modules[name].toggleSilently();
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
			const SERVICES_LISTEN_ENDPOINT = new URL("/listen", SERVICES_SERVER);
			/** @type {EventSource} */
			let ircSource;
			let systemMessageColor;
			// maps an IRC PlatformID to a "readable" name,
			// e.g. "impact:discord" is a protected platform ID (requires auth) used by our discord
			// bot to mirror messages over
			// "impact:client", however, isn't protected,
			// since this is a public client and
			// we have no way of being able to trust the client without this e.g. being possible to emulate the client.
			const PID_REG = "https://raw.githubusercontent.com/Impact-IMChat/platform-id-registry/refs/heads/main/registry.json";
			const PLATFORM_ID_TO_READABLE = await fetch(PID_REG).then(r => r.json());
			/** @param {MessageEvent} e */
			function onIRCMessage(e) {
				const { message, author, platformID } = JSON.parse(e.data);
				if (author === null && platformID === undefined) {
					game.chat.addChat({
						text: \`[Impact] IRC server: \${message}\`,
						color: systemMessageColor[1]
					});
					return;
				}
				const readable = PLATFORM_ID_TO_READABLE[platformID] ?? platformID;
				game.chat.addChat({
					text: \`[Impact IRC] \${author} via \${readable}: \${message}\`
				});
			}
			function startIRC() {
				// it's already connected, what is the point?
				if (ircSource !== undefined) return;
				ircSource = new EventSource(SERVICES_LISTEN_ENDPOINT);
				ircSource.addEventListener("message", onIRCMessage);
				ircSource.addEventListener("error", e => {
					game.chat.addChat({
						text: "[Impact] Error while connecting to IMChat / IRC, see console! (reconnecting in 3s)",
					});
					console.error(e);
					stopIRC();
					setTimeout(startIRC, 3e3);
				});
			}
			function stopIRC() {
				// don't try to close it, if it's already closed or not connected.
				if (ircSource === undefined) return;
				ircSource.close();
				ircSource = undefined;
			}
			Services = new Module("Services", function(enabled) {
				if (enabled)
					startIRC();
				else stopIRC();
			}, "Client", () => "Client");
			Services.toggleSilently();
			servicesName = Services.addoption("Name", String, SERVICES_UNSET_NAME);
			systemMessageColor = Services.addoption("SystemMessageColor", String, "blue");

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

			const criticals = new Module("Criticals", () => {}, "Combat", () => "Packet");
			criticals.toggleSilently();

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
			let lastAttackTime = 0;
			let killauraShowingDI = false;
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
			function lol() {
				const a = tagsWhileSneaking[1];
				const b = tagsInMM[1];
				if (a && b)
					return "Sneak & MM";
				return a
					? "Sneak"
					:
						b
							? "MM"
							: "Turn the module off at this point";
			}
			showNametags = new Module(
				"ShowNametags", () => {}, "Render",
				lol
			);
			tagsWhileSneaking = showNametags.addoption("WhileSneaking", Boolean, true);
			tagsInMM = showNametags.addoption("InMurderMystery", Boolean, true);
			murderMystery = new Module("MurderMystery", () => {
				// implemented in hooks (see the handleMurderMysteryHook function)
			}, "Minigames", () => "Classic");
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

						// Update last attack time when attacking
						if (attacked > 0) {
							lastAttackTime = Date.now();
						}

						// Show Dynamic Island with target info (with 1 second grace period)
						if (enabledModules["DynamicIsland"]) {
							const timeSinceLastAttack = Date.now() - lastAttackTime;
							if (attackList.length > 0 && attackList[0] && timeSinceLastAttack < 1000) {
								const target = attackList[0];
								const health = target.getHealth();
								const maxHealth = 20;
								// Remove rich text formatting
								const cleanName = target.name.replace(/\\\\[a-z]+\\\\/g, '');
								
								dynamicIsland.show({
									duration: 0,
									width: 300,
									height: 60,
									elements: [
										{ type: "text", content: cleanName, x: 0, y: -12, color: "#fff", size: 15, bold: true },
										{ type: "text", content: Math.round(health) + "/" + maxHealth + " HP", x: 0, y: 8, color: "#aaa", size: 11 },
										{ type: "progress", value: health / maxHealth, x: 0, y: 22, width: 260, height: 4, color: "#ff4444", rounded: true }
									]
								});
								killauraShowingDI = true;
							} else if (timeSinceLastAttack >= 1000 && killauraShowingDI) {
								// Only hide if Killaura was showing it
								dynamicIsland.hide();
								killauraShowingDI = false;
							}
						}

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
					
					// Hide Dynamic Island if Killaura was showing it
					if (killauraShowingDI && enabledModules["DynamicIsland"]) {
						dynamicIsland.hide();
						killauraShowingDI = false;
					}
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
			
			new Module("FastBreak", function() {}, "Broken", () => "Client-Side");

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
			flyvert = fly.addoption("Vertical", Number, 0.12);


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
						ticks++;
						const dir = getMoveDirection(0.3867);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						const goUp = keyPressedDump("space");
						const goDown = keyPressedDump("shift");
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

// Speed (this has been patched)
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
}, "Movement", () => \`V \${speedvalue[1]} J \${speedjump[1]} \${speedauto[1] ? "A" : "M"}\`);

// Options
speedbypass = speed.addoption("Bypass", Boolean, true);
speedvalue = speed.addoption("Speed", Number, 0.19);
speedjump = speed.addoption("JumpHeight", Number, 0.19);
speedauto = speed.addoption("AutoJump", Boolean, true);

			const step = new Module("Step", function() {}, "Player", () => \`\${stepheight[1]}\`);
			stepheight = step.addoption("Height", Number, 0.5);


			new Module("ESP", function() {}, "Render",() => "Highlight");

			// let lGlass;
			// let liquidGlassWaitPromise;

			// function liquidGlass() {
			// 	if (lGlass) {
			// 		return Promise.resolve(lGlass);
			// 	} else {
			// 		return liquidGlassWaitPromise;
			// 	}
			// }

			// liquidGlassWaitPromise = import("https://raw.githack.com/ProgMEM-CC/miniblox.impact.client.updatedv2/refs/heads/dynamic-island/liquidGlass.js").then(mod => {
			// 	lGlass = mod;
			// 	return lGlass;
			// });

			// === Dynamic Island Module ===
			// Session start time (global scope)
			let sessionStartTime = Date.now();
			
			const dynamicIslandModule = new Module("DynamicIsland", function(enabled) {
				if (enabled) {
					// Create DOM element
					dynamicIslandElement = document.createElement("div");
					dynamicIslandElement.id = "dynamic-island";
					dynamicIslandElement.style.cssText = \`
						position: fixed;
						top: 15px;
						left: 50%;
						transform: translateX(-50%);
						background: rgba(20, 20, 20, 0.7);
						border-radius: 20px;
						box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
						transition: width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
						z-index: 9999;
						pointer-events: none;
						width: 200px;
						height: 40px;
						backdrop-filter: blur(20px);
					\`;

					dynamicIslandContent = document.createElement("div");
					dynamicIslandContent.style.cssText = \`
						position: relative;
						width: 100%;
						height: 100%;
						transition: opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
					\`;

					dynamicIslandElement.appendChild(dynamicIslandContent);
					document.body.appendChild(dynamicIslandElement);

					/**
					 * length * size
					 * @param {string} s the string to calculate the estimate width of.
					 * @param {number} size the size of the string
					**/
					function getStringWidth(s, size) {
						return s.length * size;
					}

					// Set default display (updated every 550ms)
					const updateDefaultDisplay = () => {
						// duration is 0 for only the default display
						if (!enabledModules["DynamicIsland"]
							|| (dynamicIslandCurrentRequest && !dynamicIslandCurrentRequest.defaultDisplay)) return;

						const inGame = game.inGame();
						
						// Calculate session time
						const sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
						const hours = Math.floor(sessionTime / 3600);
						const minutes = Math.floor((sessionTime % 3600) / 60);
						const seconds = sessionTime % 60;
						const timeStr = hours > 0
							? \`\${hours}h \${minutes}m\`
							: minutes > 0
								? \`\${minutes}m \${seconds}s\`
								: \`\${seconds}s\`;

						// Pill-shaped horizontal layout with even spacing
						if (inGame) {
							const fps = Math.floor(game.resourceMonitor.filteredFPS);
							// do NOT use instantPing, it is never updated. use filteredPing instead.
							const ping = Math.floor(game.resourceMonitor.filteredPing);
							const imgWidth = 47;
							const fpsLbl = \`\${fps} FPS\`;
							const pingLbl = \`\${ping} Ping\`;
							const baseWidth = 267;
							const estimatedFPSLen = getStringWidth(fpsLbl, 18);
							const estimatedPingLen = getStringWidth(pingLbl, 12);
							const estimatedTimeLen = getStringWidth(timeStr, 11);
							const accountedWidth = baseWidth
								+ imgWidth
								// choose whichever one is bigger.
								// ping doesn't really count since it's on a different line
								+ (Math.max(estimatedFPSLen, estimatedPingLen) + 2)
								+ estimatedTimeLen;
							const logoX = - (accountedWidth / 2 - 30);
							const timeX = (accountedWidth / 2) - (estimatedTimeLen / 1.2);
							const perfX = timeX / 2;
							dynamicIslandDefaultDisplay = {
								duration: 0,
								defaultDisplay: true,
								width: accountedWidth,
								height: 47,
								elements: [
									// Logo
									{ type: "image", src: "https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/blob/main/logo.png?raw=true", x: logoX, y: 0, width: 22, height: 22 },
									// Impact V6
									{ type: "text", content: "Impact V6", x: 0, y: 0, color: "#fff", size: 13, bold: true },
									{ type: "text", content: fpsLbl, x: perfX, y: -4, color: "#0FB3A0", size: 18 },
									{ type: "text", content: pingLbl, x: perfX, y: 12, color: "#0FB3A0", size: 12 },
									// Session time 
									{ type: "text", content: timeStr, x: timeX, y: 0, color: "#ffd700", size: 11, bold: true }
								]
							};
						} else {
							const baseWidth = 150;
							const estimatedTimeLen = getStringWidth(timeStr, 11);
							// a tiny bit of padding
							const timeAccountedWidth = baseWidth + estimatedTimeLen;
							const logoX = - (timeAccountedWidth / 2) + 18;
							const timeX = (accountedWidth / 2) - (estimatedTimeLen / 1.2);
							dynamicIslandDefaultDisplay = {
								duration: 0,
								defaultDisplay: true,
								width: timeAccountedWidth,
								height: 32,
								elements: [
									// Logo
									{ type: "image", src: "https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/blob/main/logo.png?raw=true", x: logoX, y: 0, width: 22, height: 22 },
									{ type: "text", content: "Impact V6", x: 0, y: 0, color: "#fff", size: 13, bold: true },
									{ type: "text", content: timeStr, x: timeX, y: 0, color: "#ffd700", size: 11, bold: true }
								]
							};
						}
						
						dynamicIsland.show(dynamicIslandDefaultDisplay);
					};
					
					// Initial display
					updateDefaultDisplay();
					
					// Update default display every 550ms
					dynamicIslandUpdateInterval = setInterval(updateDefaultDisplay, 550);
					
				} else {
					// Remove DOM element
					if (dynamicIslandElement) {
						dynamicIslandElement.remove();
						dynamicIslandElement = null;
						dynamicIslandContent = null;
					}
					if (dynamicIslandTimeout) clearTimeout(dynamicIslandTimeout);
					if (dynamicIslandUpdateInterval) clearInterval(dynamicIslandUpdateInterval);
					dynamicIslandCurrentRequest = null;
					dynamicIslandDefaultDisplay = null;
				}
			}, "Render", () => "Adaptive");
			
			const textgui = new Module("TextGUI", function() {}, "Render");
			textguifont = textgui.addoption("Font", String, "Poppins");
			textguisize = textgui.addoption("TextSize", Number, 15);
			textguishadow = textgui.addoption("Shadow", Boolean, true);
			textgui.toggleSilently();
			new Module("AutoRespawn", function() {}, "Player");

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
					modules["ScriptManager"].toggleSilently();
				});
				closeBtn.style.width = "100%";
				
				container.appendChild(title);
				container.appendChild(addButtonsContainer);
				container.appendChild(scriptList);
				container.appendChild(closeBtn);
				modal.appendChild(container);
				
				modal.onclick = (e) => {
					if (e.target === modal) modules["ScriptManager"].toggleSilently();
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
							modules["ScriptManager"].toggleSilently();
							setTimeout(() => modules["ScriptManager"].toggleSilently(), 100);
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
						handleInRange(breakerrange[1], b => {
							if (b instanceof BlockDragonEgg) {
								// Show notification on break
								if (enabledModules["DynamicIsland"]) {
									const dynamicIsland = globalThis.${storeName}.dynamicIsland;
									dynamicIsland.show({
										duration: 1500,
										width: 220,
										height: 60,
										elements: [
											{ type: "text", content: "Breaker", x: 0, y: -8, color: "#fff", size: 13, bold: true },
											{ type: "text", content: "Block broken", x: 0, y: 12, color: "#888", size: 11 }
										]
									});
								}
								return true;
							}
							return false;
						});
					}
				}
				else delete tickLoop["Breaker"];
			}, "Minigames", () => \`\${breakerrange[1]} block\${breakerrange[1] == 1 ? "" : "s"}\`);
			breakerrange = breaker.addoption("Range", Number, 10);

			// Nuker
			let nukerRange, lastBreak, nukerDelay;
			function breakWithRateLimit(b) {
				const diff = Math.abs(lastBreak - Date.now());
				if (!!lastBreak && diff <= nukerDelay[1]) return;
				lastBreak = Date.now();
				blockHandlers.breakBlock(b);
			}
			const nuker = new Module("Nuker", function(callback) {
				if (callback) {
					tickLoop["Nuker"] = function() {
						let offset = nukerRange[1];
						handleInRange(nukerRange[1], undefined, breakWithRateLimit);
					}
				}
				else delete tickLoop["Nuker"];
			}, "World", () => \`\${nukerRange[1]} block\${nukerRange[1] == 1 ? "" : "s"}\`);
			nukerRange = nuker.addoption("Range", Number, 5);
			nukerDelay = nuker.addoption("Delay", Number, 1);

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

			
// Improved ChestSteal Module with Dynamic Island Integration
let cheststealblocks, cheststealtools, cheststealdelay, cheststealsilent;
let cheststealignoreFull, cheststealminStack, cheststealEnchantedOnly;
let lastStealTime = 0;
let cheststeal_initialQueueSize = 0;
let showChestStealCloseIsland = false;

const cheststeal = new Module("ChestSteal", function(callback) {
    if (callback) {
        let lastContainer = null;
        let stealQueue = [];
        let isProcessing = false;

        tickLoop["ChestSteal"] = function() {
            const now = Date.now();

            // Check if we have a chest open
            if (player.openContainer &&
                player.openContainer instanceof ContainerChest &&
                player.openContainer !== lastContainer) {

                lastContainer = player.openContainer;
                stealQueue = [];

                // Check if inventory is full
                if (cheststealignoreFull[1] && isInventoryFull()) {
                    if (cheststealsilent[1]) {
                        setTimeout(() => player.closeScreen(), 50);
                    }
                    return;
                }

                // Scan chest for valuable items
                for(let i = 0; i < player.openContainer.numRows * 9; i++) {
                    const slot = player.openContainer.inventorySlots[i];
                    if (!slot.getHasStack()) continue;

                    const stack = slot.getStack();
                    const item = stack.getItem();

                    // Check minimum stack size
                    if (cheststealminStack[1] > 1 && stack.stackSize < cheststealminStack[1]) {
                        continue;
                    }

                    // Check for enchantments if enabled
                    if (cheststealEnchantedOnly[1]) {
                        const enchants = stack.getEnchantmentTagList();
                        if (!enchants || enchants.length === 0) {
                            continue;
                        }
                    }

                    // Determine if item should be stolen
                    let shouldSteal = false;
                    let priority = 0;

                    // High priority: Weapons and armor
                    if (item instanceof ItemSword || item instanceof ItemArmor) {
                        shouldSteal = true;
                        priority = 100;

                        // Higher priority for better materials
                        const name = stack.getDisplayName().toLowerCase();
                        if (name.includes("diamond")) priority += 50;
                        else if (name.includes("iron")) priority += 30;
                        else if (name.includes("chain")) priority += 20;
                    }

                    // High priority: Golden apples and ender pearls
                    if (item instanceof ItemAppleGold) {
                        shouldSteal = true;
                        priority = 150; // Very high priority
                    }

                    // High priority: Food items
                    if (item instanceof ItemFood) {
                        shouldSteal = true;
                        priority = 90;

                        const foodName = stack.getDisplayName().toLowerCase();
                        // Higher priority for better food
                        if (foodName.includes("golden apple")) priority = 150;
                        else if (foodName.includes("steak") || foodName.includes("beef")) priority = 95;
                        else if (foodName.includes("porkchop") || foodName.includes("cooked")) priority = 95;
                        else if (foodName.includes("apple")) priority = 85;
                        else if (foodName.includes("bread")) priority = 80;
                    }

                    // Medium-High priority: Bows
                    if (item instanceof ItemBow) {
                        shouldSteal = true;
                        priority = 80;
                    }

                    // High priority: Flint and Steel (fire charge alternative)
                    const itemName = stack.getDisplayName().toLowerCase();
                    if (itemName.includes("flint and steel") || itemName.includes("fire charge")) {
                        shouldSteal = true;
                        priority = 85;
                    }

                    // High priority: Ember Stones (custom item)
                    if (itemName.includes("ember stone") || itemName.includes("emberstone")) {
                        shouldSteal = true;
                        priority = 85;
                    }

                    // Optional: Blocks
                    if (cheststealblocks[1] && item instanceof ItemBlock) {
                        const blockName = stack.getDisplayName().toLowerCase();

                        // Skip common junk blocks
                        const junkBlocks = ["dirt", "cobblestone", "stone", "gravel", "sand"];
                        const isJunk = junkBlocks.some(junk => blockName.includes(junk));

                        if (!isJunk) {
                            shouldSteal = true;
                            priority = 40;

                            // Higher priority for useful blocks
                            if (blockName.includes("wood") || blockName.includes("plank")) priority += 20;
                            if (blockName.includes("wool")) priority += 10;
                        }
                    }

                    // Optional: Tools
                    if (cheststealtools[1] && (item instanceof ItemTool || item instanceof ItemPickaxe)) {
                        shouldSteal = true;
                        priority = 60;

                        const name = stack.getDisplayName().toLowerCase();
                        if (name.includes("diamond")) priority += 40;
                        else if (name.includes("iron")) priority += 20;
                    }

                    // Add enchantment bonus to priority
                    const enchants = stack.getEnchantmentTagList();
                    if (enchants && enchants.length > 0) {
                        priority += enchants.length * 10;
                    }

                    if (shouldSteal) {
                        stealQueue.push({ index: i, priority: priority });
                    }
                }

                // Sort queue by priority (highest first)
                stealQueue.sort((a, b) => b.priority - a.priority);
                cheststeal_initialQueueSize = stealQueue.length;
				showChestStealCloseIsland = true;

                // Show chest opened on Dynamic Island
                if (enabledModules["DynamicIsland"]) {
                    dynamicIsland.show({
                        duration: 2000,
                        width: 300,
                        height: 70,
                        elements: [
                            { type: "text", content: "Chest Opened", x: 0, y: -15, color: "#ffd700", size: 15, bold: true },
                            { type: "text", content: cheststeal_initialQueueSize + " items found", x: 0, y: 12, color: "#fff", size: 12 }
                        ]
                    });
                }

                // Start stealing process
                isProcessing = true;
            }

            // Process steal queue with delay
            if (isProcessing && stealQueue.length > 0 &&
                now - lastStealTime >= cheststealdelay[1]) {

                // Check if inventory is full before each steal
                if (cheststealignoreFull[1] && isInventoryFull()) {
                    isProcessing = false;
                    stealQueue = [];
                    if (cheststealsilent[1]) {
                        setTimeout(() => player.closeScreen(), 50);
                    }
                    return;
                }

                const slotData = stealQueue.shift();

                // Shift-click to quickly move item
                playerControllerDump.windowClickDump(
                    player.openContainer.windowId,
                    slotData.index,
                    0,
                    1, // Shift-click mode
                    player
                );

                lastStealTime = now;

                // Show progress on Dynamic Island
                if (enabledModules["DynamicIsland"]) {
                    const stolen = cheststeal_initialQueueSize - stealQueue.length;
                    const progress = cheststeal_initialQueueSize > 0 ? stolen / cheststeal_initialQueueSize : 0;
                    const speed = (1000 / cheststealdelay[1]).toFixed(1);

                    dynamicIsland.show({
                        duration: 0,
                        width: 320,
                        height: 85,
                        elements: [
                            { type: "text", content: "ChestSteal", x: 0, y: -25, color: "#fff", size: 15, bold: true },
                            { type: "progress", value: progress, x: 0, y: -8, width: 280, height: 8, color: "#ffd700", rounded: true },
                            { type: "text", content: stolen + " / " + cheststeal_initialQueueSize, x: -110, y: 10, color: "#ffd700", size: 12, bold: true },
                            { type: "text", content: stealQueue.length + " left", x: 40, y: 10, color: "#888", size: 11 },
                            { type: "text", content: speed + " items/s", x: 0, y: 28, color: "#0FB3A0", size: 10 }
                        ]
                    });
                }

                // Close chest when done if silent mode is enabled
                if (stealQueue.length === 0) {
                    isProcessing = false;
                    if (cheststealsilent[1]) {
                        setTimeout(() => player.closeScreen(), 50);
                    }

                    // Show completion on Dynamic Island
                    if (enabledModules["DynamicIsland"]) {
                        dynamicIsland.show({
                            duration: 500,
                            width: 260,
                            height: 50,
                            elements: [
                                { type: "text", content: "✓ Chest Closed", x: 0, y: 0, color: "#0FB3A0", size: 14, bold: true }
                            ]
                        });
                    }
                }
            }

            // Reset lastContainer when chest is closed
            if (!player.openContainer || !(player.openContainer instanceof ContainerChest)) {
                lastContainer = null;
                isProcessing = false;
                stealQueue = [];

                // Show closed message if not already shown
                if (enabledModules["DynamicIsland"] && showChestStealCloseIsland) {
                    dynamicIsland.show({
                        duration: 1000,
                        width: 260,
                        height: 50,
                        elements: [
                            { type: "text", content: "✓ Chest Closed", x: 0, y: 0, color: "#0FB3A0", size: 14, bold: true }
                        ]
                    });
                    showChestStealCloseIsland = false;
                }
            }
        };
    } else {
        delete tickLoop["ChestSteal"];
    }
}, "World", () => {
    const parts = [];
    if (cheststealblocks[1]) parts.push("B");
    if (cheststealtools[1]) parts.push("T");
    if (cheststealsilent[1]) parts.push("Silent");
    if (cheststealEnchantedOnly[1]) parts.push("Ench");
    return parts.join(" ") || "Basic";
});

// Helper function to check if inventory is full
function isInventoryFull() {
    for (let i = 9; i < 36; i++) {
        const slot = player.inventory.main[i];
        if (!slot || slot.stackSize === 0) {
            return false;
        }
    }
    return true;
}

// Options
cheststealblocks = cheststeal.addoption("Blocks", Boolean, true);
cheststealtools = cheststeal.addoption("Tools", Boolean, true);
cheststealdelay = cheststeal.addoption("Delay", Number, 50);
cheststealsilent = cheststeal.addoption("Silent", Boolean, true);
cheststealignoreFull = cheststeal.addoption("IgnoreWhenFull", Boolean, true);
cheststealminStack = cheststeal.addoption("MinStackSize", Number, 1);
cheststealEnchantedOnly = cheststeal.addoption("EnchantedOnly", Boolean, false);

// Set ranges
cheststealdelay.range = [0, 500, 10];
cheststealminStack.range = [1, 64, 1];


// Fixed Scaffold Module (should work 99%)
let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle, scaffoldSameY;
let tickCount = 0;
let lastScaffoldY = null; // Track the Y coordinate for sameY mode

function getPossibleSides(pos) {
    const possibleSides = [];
    for (const side of EnumFacing.VALUES) {
        const offset = side.toVector();
        const checkPos = new BlockPos(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z);
        const state = game.world.getBlockState(checkPos);
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

function findBlockSlots() {
    const slotsWithBlocks = [];
    for (let i = 0; i < 9; i++) {
        const item = player.inventory.main[i];
        if (item &&
            item.item instanceof ItemBlock &&
            item.item.block.getBoundingBox().max.y === 1 &&
            item.item.name !== "tnt") {
            slotsWithBlocks.push(i);
        }
    }
    return slotsWithBlocks;
}

function countBlocks() {
    let totalBlocks = 0;
    for (let i = 0; i < 36; i++) {
        const item = player.inventory.main[i];
        if (item && item.item instanceof ItemBlock && 
            item.item.block.getBoundingBox().max.y === 1 &&
            item.item.name !== "tnt") {
            totalBlocks += item.stackSize;
        }
    }
    return totalBlocks;
}

let scaffoldInitialBlocks = 0;
let scaffoldLastPos = null;
let scaffoldLastTime = 0;
let scaffoldSpeed = 0;

const scaffold = new Module("Scaffold", function(callback) {
    if (callback) {
        if (player) {
            oldHeld = game.info.selectedSlot;
            scaffoldInitialBlocks = countBlocks();
            scaffoldLastPos = player.pos.clone();
            scaffoldLastTime = Date.now();
            scaffoldSpeed = 0;
        }

        game.chat.addChat({
            text: "V2 Scaffold Bypasser?!",
            color: "royalblue"
        });

        tickLoop["Scaffold"] = function() {
            tickCount++;

            // Auto-select blocks & cycle
            const blockSlots = findBlockSlots();
            if (blockSlots.length === 0) return;

            if (blockSlots.length >= 2 && scaffoldcycle[1] > 0) {
                const selected = Math.floor(tickCount / scaffoldcycle[1]) % blockSlots.length;
                switchSlot(blockSlots[selected]);
            } else {
                switchSlot(blockSlots[0]);
            }

            const item = player.inventory.getCurrentItem();
            if (!item || !(item.getItem() instanceof ItemBlock)) return;

            // Calculate speed (blocks per second)
            const currentTime = Date.now();
            const timeDiff = (currentTime - scaffoldLastTime) / 1000; // seconds
            
            if (timeDiff >= 0.1) { // Update every 100ms
                const currentPos = player.pos;
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - scaffoldLastPos.x, 2) +
                    Math.pow(currentPos.z - scaffoldLastPos.z, 2)
                );
                scaffoldSpeed = distance / timeDiff;
                scaffoldLastPos = currentPos.clone();
                scaffoldLastTime = currentTime;
            }

            // Show Dynamic Island with block count and speed
            if (enabledModules["DynamicIsland"]) {
                const currentBlocks = countBlocks();
                const progress = scaffoldInitialBlocks > 0 ? currentBlocks / scaffoldInitialBlocks : 0;
                
                dynamicIsland.show({
                    duration: 0,
                    width: 280,
                    height: 75,
                    elements: [
                        { type: "text", content: "Scaffolding", x: 0, y: -20, color: "#fff", size: 14, bold: true },
                        { type: "text", content: currentBlocks + "/" + scaffoldInitialBlocks + " blocks", x: 0, y: -2, color: "#aaa", size: 11 },
                        { type: "text", content: scaffoldSpeed.toFixed(1) + " b/s", x: 0, y: 12, color: "#0FB3A0", size: 11 },
                        { type: "progress", value: progress, x: 0, y: 28, width: 240, height: 4, color: "#0FB3A0", rounded: true }
                    ]
                });
            }
            // Check if player is moving (any movement key pressed)
            const isMoving = player.moveForwardDump !== 0 || player.moveStrafeDump !== 0;

            // Calculate positions - MORE AGGRESSIVE PREDICTION
            const playerX = Math.floor(player.pos.x);
            const playerY = Math.floor(player.pos.y);
            const playerZ = Math.floor(player.pos.z);

            // Determine target Y coordinate based on sameY mode
            let targetY;
            if (scaffoldSameY[1]) {
                if (isMoving) {
                    // When moving, use the last scaffold Y or initialize it
                    if (lastScaffoldY === null) {
                        lastScaffoldY = playerY - 1;
                    }
                    targetY = lastScaffoldY;
                } else {
                    // When not moving (stationary jump), allow placing under player
                    targetY = playerY - 1;
                    lastScaffoldY = targetY;
                }
            } else {
                // Normal mode: always place under player
                targetY = playerY - 1;
                lastScaffoldY = targetY;
            }

            // Predict further ahead based on motion
            const predictionMultiplier = scaffoldextend[1] * 2; // 2x for skywars speed
            const futureX = player.pos.x + player.motion.x * predictionMultiplier;
            const futureZ = player.pos.z + player.motion.z * predictionMultiplier;
            const flooredFutureX = Math.floor(futureX);
            const flooredFutureZ = Math.floor(futureZ);

            // Check MORE positions for faster bridging
            const positionsToCheck = [
                new BlockPos(flooredFutureX, targetY, flooredFutureZ), // Future position first!
                new BlockPos(playerX, targetY, playerZ),
            ];

            // Also check diagonal positions for fast strafing
            if (Math.abs(player.motion.x) > 0.1 || Math.abs(player.motion.z) > 0.1) {
                positionsToCheck.push(
                    new BlockPos(flooredFutureX, targetY, playerZ),
                    new BlockPos(playerX, targetY, flooredFutureZ)
                );
            }

            for (const pos of positionsToCheck) {
                const blockAtPos = game.world.getBlockState(pos).getBlock();

                // Skip if not air
                if (blockAtPos.material !== Materials.air) continue;

                // Find a side to place on
                let placeSide = getPossibleSides(pos);

                // If no direct side, search nearby (FASTER search for skywars)
                if (!placeSide) {
                    let found = false;
                    // Smaller search radius but prioritize close blocks
                    for (let dist = 1; dist <= 2 && !found; dist++) {
                        for (let x = -dist; x <= dist && !found; x++) {
                            for (let z = -dist; z <= dist && !found; z++) {
                                if (x === 0 && z === 0) continue;
                                const searchPos = new BlockPos(pos.x + x, pos.y, pos.z + z);
                                const side = getPossibleSides(searchPos);
                                if (side) {
                                    placeSide = side;
                                    found = true;
                                }
                            }
                        }
                    }
                }

                if (!placeSide) continue;

                // Calculate place position
                const dir = placeSide.getOpposite().toVector();
                const placePos = new BlockPos(
                    pos.x + dir.x,
                    pos.y + dir.y,
                    pos.z + dir.z
                );

                // Calculate hit vector (randomized on face)
                function getRandomHitVec(placePos, face) {
                    const rand = () => 0.2 + Math.random() * 0.6;
                    let hitX = placePos.x + 0.5;
                    let hitY = placePos.y + 0.5;
                    let hitZ = placePos.z + 0.5;

                    if (face.getAxis() === "Y") {
                        hitX = placePos.x + rand();
                        hitY = placePos.y + (face === EnumFacing.UP ? 0.99 : 0.01);
                        hitZ = placePos.z + rand();
                    } else if (face.getAxis() === "X") {
                        hitX = placePos.x + (face === EnumFacing.EAST ? 0.99 : 0.01);
                        hitY = placePos.y + rand();
                        hitZ = placePos.z + rand();
                    } else {
                        hitX = placePos.x + rand();
                        hitY = placePos.y + rand();
                        hitZ = placePos.z + (face === EnumFacing.SOUTH ? 0.99 : 0.01);
                    }

                    return new Vector3$1(hitX, hitY, hitZ);
                }

                const hitVec = getRandomHitVec(placePos, placeSide);

                // Tower mode - IMPROVED
                if (scaffoldtower[1] &&
                    keyPressedDump("space") &&
                    player.onGround) {

                    // Less strict centering for faster towering
                    const centerDist = Math.sqrt(
                        Math.pow(player.pos.x - (playerX + 0.5), 2) +
                        Math.pow(player.pos.z - (playerZ + 0.5), 2)
                    );

                    if (centerDist < 0.3 && player.motion.y < 0.2 && player.motion.y >= 0) {
                        player.motion.y = 0.42;
                    }
                }

                // Try to place block
                if (playerControllerDump.onPlayerRightClick(
                    player,
                    game.world,
                    item,
                    placePos,
                    placeSide,
                    hitVec
                )) {
                    hud3D.swingArm();

                    // Handle item stack
                    if (item.stackSize === 0) {
                        player.inventory.main[player.inventory.currentItem] = null;
                    }
                }

                break; // Only place one block per tick
            }
        };
    } else {
        if (player && oldHeld !== undefined) {
            switchSlot(oldHeld);
        }
        delete tickLoop["Scaffold"];
        
        // Hide Dynamic Island when disabled
        if (enabledModules["DynamicIsland"]) {
            dynamicIsland.hide();
        }
        lastScaffoldY = null; // Reset the Y coordinate when scaffold is disabled
    }
}, "World");

scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);
scaffoldSameY = scaffold.addoption("SameY", Boolean, false);

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
			antiban.toggleSilently();
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
		const essentials = ["gapple", "golden apple", "ender pearl", "fire charge", "ember stone"];
		const customKeep = ["god helmet", "legend boots"];
		const bestArmor = {};
		const bestWeapons = {}; // Separate weapons from tools
		const bestTools = {}; // Pickaxe, Axe, Shovel, etc.
		let lastRun = 0;

		function getArmorScore(stack) {
			const item = stack.getItem();
			const material = item.getArmorMaterial?.()?.toLowerCase?.() ?? "unknown";
			const priority = armorPriority.indexOf(material);
			const durability = stack.getMaxDamage() - stack.getItemDamage();
			const enchants = stack.getEnchantmentTagList()?.length ?? 0;
			return (priority === -1 ? -999 : priority * 10000) + durability + (enchants * 500);
		}

		function getMaterialScore(name) {
			name = name.toLowerCase();
			if (name.includes("diamond")) return 1000;
			if (name.includes("iron")) return 500;
			if (name.includes("stone")) return 100;
			if (name.includes("wood")) return 50;
			if (name.includes("gold")) return 300; // Gold is weak but valuable
			return 0;
		}

		function getEnchantmentScore(stack) {
			const enchants = stack.getEnchantmentTagList();
			if (!enchants || enchants.length === 0) return 0;
			
			let score = 0;
			for (const enchant of enchants) {
				const level = enchant.lvl ?? 1;
				const id = enchant.id ?? 0;
				
				// High value enchants
				if (id === 16 || id === 20) score += level * 200; // Sharpness, Fire Aspect
				else if (id === 19 || id === 21) score += level * 150; // Knockback, Looting
				else if (id === 0 || id === 1 || id === 3 || id === 4) score += level * 180; // Protection, Fire Protection, Blast Protection, Projectile Protection
				else if (id === 32 || id === 34) score += level * 100; // Efficiency, Unbreaking
				else if (id === 48 || id === 49 || id === 50 || id === 51) score += level * 120; // Power, Punch, Flame, Infinity
				else score += level * 50; // Other enchants
			}
			return score;
		}

		function getWeaponScore(stack, item) {
			const name = stack.getDisplayName().toLowerCase();
			const material = getMaterialScore(name);
			const enchantScore = getEnchantmentScore(stack);
			const durability = stack.getMaxDamage() > 0 ? (stack.getMaxDamage() - stack.getItemDamage()) : 1000;
			
			let baseScore = 0;
			if (item instanceof ItemSword) {
				baseScore = 1000;
			} else if (item instanceof ItemBow) {
				baseScore = 900;
			}
			
			// Material is VERY important - diamond should always beat stone even with enchants
			return baseScore + (material * 2) + enchantScore + (durability * 0.1);
		}

		function getToolScore(stack, item) {
			const name = stack.getDisplayName().toLowerCase();
			const material = getMaterialScore(name);
			const enchantScore = getEnchantmentScore(stack);
			const durability = stack.getMaxDamage() > 0 ? (stack.getMaxDamage() - stack.getItemDamage()) : 1000;
			
			let baseScore = 0;
			if (item instanceof ItemPickaxe) {
				baseScore = 800;
			} else if (item instanceof ItemAxe) {
				baseScore = 700;
			} else if (item instanceof ItemSpade) {
				baseScore = 600;
			} else if (item instanceof ItemTool) {
				baseScore = 500;
			}
			
			return baseScore + (material * 2) + enchantScore + (durability * 0.1);
		}

		function getToolType(item) {
			if (item instanceof ItemPickaxe) return "pickaxe";
			if (item instanceof ItemAxe) return "axe";
			if (item instanceof ItemSpade) return "shovel";
			if (item instanceof ItemHoe) return "hoe";
			return "tool";
		}

		function shouldKeep(stack) {
			const name = stack.getDisplayName().toLowerCase();
			const item = stack.getItem();
			
			// Always keep essentials
			if (essentials.some(k => name.includes(k))) return true;
			if (customKeep.some(k => name.includes(k))) return true;
			
			// Always keep blocks
			if (item instanceof ItemBlock) return true;
			
			// Keep food
			if (item instanceof ItemFood) return true;
			
			return false;
		}

		tickLoop["InvCleaner"] = function () {
			const now = Date.now();
			if (now - lastRun < 200) return;
			lastRun = now;

			const slots = player?.inventoryContainer?.inventorySlots;
			if (!player.openContainer || player.openContainer !== player.inventoryContainer || !slots || slots.length < 36) return;

			Object.keys(bestArmor).forEach(k => delete bestArmor[k]);
			Object.keys(bestWeapons).forEach(k => delete bestWeapons[k]);
			Object.keys(bestTools).forEach(k => delete bestTools[k]);

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

				// Skip items that should always be kept
				if (shouldKeep(stack)) continue;

				// Handle armor
				if (item instanceof ItemArmor) {
					const armorType = item.armorType ?? "unknown";
					const key = "armor_" + armorType;
					const score = getArmorScore(stack);
					const existing = bestArmor[key];

					if (!existing) {
						bestArmor[key] = { stack, index: i, score };
					} else {
						if (score > existing.score) {
							// Only drop the old armor if it's in inventory (not equipped)
							if (existing.index < 36) {
								toDrop.push(existing.index);
							}
							bestArmor[key] = { stack, index: i, score };
						} else {
							toDrop.push(i);
						}
					}
					continue;
				}

				// Handle weapons (Sword and Bow)
				if (item instanceof ItemSword) {
					const key = "sword";
					const score = getWeaponScore(stack, item);
					const existing = bestWeapons[key];

					if (!existing) {
						bestWeapons[key] = { stack, score, index: i };
					} else if (score > existing.score) {
						toDrop.push(existing.index);
						bestWeapons[key] = { stack, score, index: i };
					} else {
						toDrop.push(i);
					}
					continue;
				}

				if (item instanceof ItemBow) {
					const key = "bow";
					const score = getWeaponScore(stack, item);
					const existing = bestWeapons[key];

					if (!existing) {
						bestWeapons[key] = { stack, score, index: i };
					} else if (score > existing.score) {
						toDrop.push(existing.index);
						bestWeapons[key] = { stack, score, index: i };
					} else {
						toDrop.push(i);
					}
					continue;
				}

				// Handle tools (Pickaxe, Axe, Shovel, etc.) - Keep only ONE of each type
				if (item instanceof ItemPickaxe || item instanceof ItemAxe || 
				    item instanceof ItemSpade || item instanceof ItemHoe || item instanceof ItemTool) {
					const toolType = getToolType(item);
					const score = getToolScore(stack, item);
					const existing = bestTools[toolType];

					if (!existing) {
						bestTools[toolType] = { stack, score, index: i };
					} else if (score > existing.score) {
						toDrop.push(existing.index);
						bestTools[toolType] = { stack, score, index: i };
					} else {
						toDrop.push(i);
					}
					continue;
				}
			}

			// Drop items
			toDrop.forEach(dropSlot);
		};
}, "Player");

function dropSlot(index) {
    const windowId = player.openContainer.windowId;
    playerControllerDump.windowClickDump(windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(windowId, -999, 0, 0, player);
}

// AutoFunnyChat
// Expanded kill messages with hopefully better grammar :skull:
const killMessages = [
    "☠️ {name} couldn't survive the wrath of ✦ IMPACT V6 ✦",
    "⚡ {name} got deleted — IMPACT V6 never lags.",
    "🔥 {name} folded instantly — IMPACT V6 ON TOP.",
    "💀 R.I.P {name} — system overloaded by IMPACT V6.",
    "✪ {name} tried to fight perfection. IMPACT V6 responded.",
    "🚀 {name} launched straight to respawn courtesy of IMPACT V6.",
    "⚙️ Calculated. Executed. {name} eliminated by IMPACT V6.",
    "💥 Boom! {name} couldn't handle the force of IMPACT V6.",
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
    "💀 {name} forgot rule #1: Don't challenge IMPACT V6.",
    "⚔️ Outplayed, outclassed, outlasted — {name} destroyed.",
    "🌐 IMPACT V6 connected. {name} disconnected.",
    "🔥 {name} evaporated under precision fire.",
    "⚙️ Advanced algorithms say: {name} = loser.",
    "💢 IMPACT V6 just rewrote {name}'s respawn code.",
    "🚨 Critical hit! {name} eliminated with style.",
    "⚡ Frame-perfect execution on {name}.",
    "♻️ {name} recycled into experience points.",
    "💣 {name} detonated by IMPACT V6.",
    "🔮 {name} predicted defeat, couldn't avoid it.",
    "💀 System log: {name} — user terminated.",
    "⚡ Fast reflexes? Not enough, {name}.",
    "🔥 {name} entered the killzone of IMPACT V6.",
    "☢️ Danger: {name} exposed to high-impact energy.",
    "🧩 {name} didn't fit the puzzle. Removed by IMPACT V6.",
    "⚔️ Duel complete — {name} eliminated cleanly.",
    "📉 {name}'s K/D ratio just dropped hard.",
    "🛠️ Patch note: {name} no longer a threat.",
    "⚙️ Efficiency 100%. {name} 0%.",
    "💀 {name} deleted by advanced targeting system.",
    "✨ Another one for the highlight reel. RIP {name}.",
    "⚡ Instant replay: {name} got obliterated.",
    "🔥 {name} ran diagnostics — result: IMPACT V6 superiority.",
    "🧠 IMPACT V6 calculated every frame. {name} didn't.",
    "💀 End of line, {name}.",
    "⚡ Shockwave detected — source: IMPACT V6.",
    "🔥 Execution complete. {name} neutralized.",
    "♛ IMPACT V6 reigns supreme. {name} dethroned.",
    "🎯 {name} was the easiest target today.",
    "💻 {name}'s game just crashed — permanently.",
    "🔒 {name} tried to escape. Access: DENIED.",
    "🌟 {name} thought they were the main character. Wrong.",
    "⚠️ Warning: {name} has been deprecated.",
    "🎮 {name} rage quit before they could even quit.",
    "💤 {name} took a dirt nap courtesy of IMPACT V6.",
    "🎪 {name} just became the circus. 🤡",
    "📴 {name} disconnected from life.",
    "🧪 Experiment complete: {name} = failure.",
];

// Configuration (NEW)
const autoFunnyChatConfig = {
    killCooldown: 3000,           // Reduced from 5000ms for faster responses
    minDelay: 300,                // Reduced from 500ms for quicker reactions
    maxDelay: 1200,               // Reduced from 1500ms
    avoidRepeat: true,
    maxHistorySize: 8,            // Increased from 5 to avoid more repeats
    enabled: true,                // Can be toggled
    customMessages: [],           // Allow users to add custom messages
    triggerPatterns: [            // More comprehensive kill detection patterns
        /(.+?) (?:was )?eliminated by (.+?)/i,
    ],
    blacklistedNames: [],         // Names to never taunt (friends, etc.)
    onlyTauntPlayers: true,       // Don't taunt bots/NPCs if detected
};

const autofunnychat = new Module("AutoFunnyChat", function(callback) {
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
            messageHistory: [],
            lastVictim: null,
            killStreak: 0,
        };
    }

    var state = window.__autoFunnyState;

    // Helper: Clean victim name (remove colors, extra spaces, etc.)
    function cleanVictimName(name) {
        if (!name) return null;

        // Remove common color codes and formatting
        var cleaned = name
            .replace(/\\+[a-z]+\\+/gi, '')  // Remove \color\ codes
            .replace(/White/gi, '')
            .replace(/§[0-9a-fk-or]/gi, '')  // Minecraft color codes
            .trim();

        // Filter out empty or very short names
        if (cleaned.length < 2) return null;

        return cleaned;
    }

    // Helper: Check if name is blacklisted
    function isBlacklisted(name) {
        if (!name) return true;
        var lowerName = name.toLowerCase();
        return autoFunnyChatConfig.blacklistedNames.some(function(blocked) {
            return lowerName.indexOf(blocked.toLowerCase()) !== -1;
        });
    }

    // Helper: Get random message with weighted selection for streaks
    function getRandomMessage(victimName) {
        var allMessages = killMessages.concat(autoFunnyChatConfig.customMessages);

        // Filter out recently used messages
        if (autoFunnyChatConfig.avoidRepeat && state.messageHistory.length > 0) {
            var availableMessages = allMessages.filter(function(msg) {
                return state.messageHistory.indexOf(msg) === -1;
            });

            if (availableMessages.length > 0) {
                allMessages = availableMessages;
            } else {
                // Reset history if we've used all messages
                state.messageHistory = [];
            }
        }

        // On kill streaks, prefer more intense messages (those with fire, skull emojis)
        if (state.killStreak >= 3) {
            var intenseMessages = allMessages.filter(function(msg) {
                return msg.indexOf('🔥') !== -1 || msg.indexOf('💀') !== -1 || msg.indexOf('☠️') !== -1;
            });
            if (intenseMessages.length > 0) {
                allMessages = intenseMessages;
            }
        }

        // Select random message
        var msg = allMessages[Math.floor(Math.random() * allMessages.length)];

        // Replace {name} placeholder
        var finalMsg = msg.replace(/{name}/g, victimName);

        // Update history
        state.messageHistory.push(msg);
        if (state.messageHistory.length > autoFunnyChatConfig.maxHistorySize) {
            state.messageHistory.shift();
        }

        return finalMsg;
    }

    // Helper: Send message with rate limiting
    function sendFunnyMessage(victimName) {
        var now = Date.now();

        // Check cooldown
        if (now - state.lastKillSent < autoFunnyChatConfig.killCooldown) {
            return false;
        }

        // Check if enabled
        if (!autoFunnyChatConfig.enabled) {
            return false;
        }

        // Get and send message
        var msg = getRandomMessage(victimName);
        if (ClientSocket && ClientSocket.sendPacket) {
            ClientSocket.sendPacket(new SPacketMessage({text: msg}));
            
            // Show Dynamic Island notification
            if (enabledModules["DynamicIsland"]) {
                const dynamicIsland = globalThis.${storeName}.dynamicIsland;
                // Truncate message if too long
                const displayMsg = msg.length > 40 ? msg.substring(0, 37) + "..." : msg;
                dynamicIsland.show({
                    duration: 2000,
                    width: 320,
                    height: 70,
                    elements: [
                        { type: "text", content: "AutoFunnyChat", x: 0, y: -15, color: "#fff", size: 13, bold: true },
                        { type: "text", content: displayMsg, x: 0, y: 5, color: "#888", size: 10 },
                        { type: "text", content: \`Streak: \${state.killStreak}\`, x: 0, y: 22, color: "#ffd700", size: 10, bold: true }
                    ]
                });
            }
        }

        // Update state
        state.lastKillSent = now;
        state.lastVictim = victimName;

        // Update kill streak
        if (state.lastVictim === victimName) {
            state.killStreak++;
        } else {
            state.killStreak = 1;
        }

        return true;
    }

    // Helper: Extract victim name from message using patterns
    function extractVictimName(messageText) {
        if (!messageText || !player) return null;

        for (var i = 0; i < autoFunnyChatConfig.triggerPatterns.length; i++) {
            var pattern = autoFunnyChatConfig.triggerPatterns[i];
            var match = messageText.match(pattern);
            if (match) {
                var victimName = null;

                // Check if pattern includes player name (meaning we need to extract victim)
                if (messageText.indexOf(player.name) !== -1) {
                    // Extract name that isn't the player's name
                    victimName = match[1];
                } else {
					return;
                }

                // Clean and validate name
                victimName = cleanVictimName(victimName);

                // Don't self-taunt
                if (victimName === player.name) {
                    return null;
                }

                // Check blacklist
                if (isBlacklisted(victimName)) {
                    return null;
                }

                return victimName;
            }
        }

        return null;
    }

    // Remove old listener if exists
    if (window.__autoFunnyKillMsgListener && ClientSocket && ClientSocket.socket && ClientSocket.socket.off) {
        ClientSocket.socket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
    }

    // Create new listener with improved detection
    window.__autoFunnyKillMsgListener = function(packet) {
        if (!packet || !packet.text || !player) return;

        // Extract victim name using all patterns
        var victimName = extractVictimName(packet.text);

        if (victimName) {
            // Random delay for more human-like behavior
            var delay = autoFunnyChatConfig.minDelay +
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
}, "Player");

// Add configuration options
var autoFunnyChatEnabled = autofunnychat.addoption("Enabled", Boolean, true);
var autoFunnyChatCooldown = autofunnychat.addoption("Cooldown", Number, 3000);
var autoFunnyChatMinDelay = autofunnychat.addoption("MinDelay", Number, 300);
var autoFunnyChatMaxDelay = autofunnychat.addoption("MaxDelay", Number, 1200);

// Update config when options change
(function() {
    var checkInterval = setInterval(function() {
        if (autoFunnyChatEnabled[1] !== undefined) {
            autoFunnyChatConfig.enabled = autoFunnyChatEnabled[1];
        }
        if (autoFunnyChatCooldown[1] !== undefined) {
            autoFunnyChatConfig.killCooldown = autoFunnyChatCooldown[1];
        }
        if (autoFunnyChatMinDelay[1] !== undefined) {
            autoFunnyChatConfig.minDelay = autoFunnyChatMinDelay[1];
        }
        if (autoFunnyChatMaxDelay[1] !== undefined) {
            autoFunnyChatConfig.maxDelay = autoFunnyChatMaxDelay[1];
        }
    }, 100);
})();

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
    let maxBoostTicks = 0;

    tickLoop["LongJump"] = function() {
        if (!player) return;

        // Detect jump key
        if (keyPressedDump("space") && player.onGround && !jumping) {
            jumping = true;
            boostTicks = ljboost[1];
            maxBoostTicks = ljboost[1];
            player.motion.y = 0.42; // vanilla jump power
            
            // Show initial notification
            if (enabledModules["DynamicIsland"]) {
                const dynamicIsland = globalThis.${storeName}.dynamicIsland;
                dynamicIsland.show({
                    duration: 0,
                    width: 240,
                    height: 70,
                    elements: [
                        { type: "text", content: "LongJump", x: 0, y: -15, color: "#fff", size: 13, bold: true },
                        { type: "progress", value: 1, x: 0, y: 5, width: 200, height: 6, color: "#0FB3A0", rounded: true },
                        { type: "text", content: boostTicks + " ticks", x: 0, y: 22, color: "#888", size: 10 }
                    ]
                });
            }
        }

        if (jumping) {
            const dir = getMoveDirection(ljpower[1]);
            player.motion.x = dir.x;
            player.motion.z = dir.z;

            // Update Dynamic Island with progress
            if (enabledModules["DynamicIsland"] && boostTicks > 0) {
                const dynamicIsland = globalThis.${storeName}.dynamicIsland;
                const progress = boostTicks / maxBoostTicks;
                dynamicIsland.show({
                    duration: 0,
                    width: 240,
                    height: 70,
                    elements: [
                        { type: "text", content: "LongJump", x: 0, y: -15, color: "#fff", size: 13, bold: true },
                        { type: "progress", value: progress, x: 0, y: 5, width: 200, height: 6, color: "#0FB3A0", rounded: true },
                        { type: "text", content: boostTicks + " ticks", x: 0, y: 22, color: "#888", size: 10 }
                    ]
                });
            }

            boostTicks--;
            if (boostTicks <= 0 || player.onGround) {
                jumping = false;
                // Hide Dynamic Island when done
                if (enabledModules["DynamicIsland"]) {
                    const dynamicIsland = globalThis.${storeName}.dynamicIsland;
                    dynamicIsland.hide();
                }
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
					
					// Dynamic Island notification
					if (enabledModules["DynamicIsland"]) {
						const dynamicIsland = globalThis.${storeName}.dynamicIsland;
						dynamicIsland.show({
							duration: 2000,
							width: 280,
							height: 60,
							elements: [
								{ type: "text", content: "Survival Mode", x: 0, y: -8, color: "#fff", size: 14, bold: true },
								{ type: "text", content: "Gamemode changed", x: 0, y: 12, color: "#888", size: 11 }
							]
						});
					}
					
					survival.toggleSilently();
				}
			}, "Misc", () => "Spoof");

			globalThis.${storeName}.modules = modules;
			globalThis.${storeName}.profile = "default";
			globalThis.${storeName}.dynamicIsland = dynamicIsland;

			window.dynamicIsland = dynamicIsland;
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
			if (realModule.enabled != module.enabled) realModule.toggleSilently();
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
			const baseCategories = ["Combat", "Movement", "Player", "Render", "World","Client","Minigames", "Misc","Exploit","Broken","Music"];
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

			// Special handling for Music category
			if (category === "Music") {
				openMusicPlayerPanel();
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

		// === Open Music Player Panel ===
		function openMusicPlayerPanel() {
			// Close if already open
			if (modulePanels["Music"]) {
				closePanelWithAnimation(modulePanels["Music"], () => {
					delete modulePanels["Music"];
					updateCategoryHighlights();
					saveGUIState();
				});
				return;
			}

			// Create horizontal music player panel (wider than normal)
			const panelCount = Object.keys(modulePanels).length;
			const { panel, content } = createPanel("MUSIC PLAYER", 280 + panelCount * 30, 40 + panelCount * 30, 400, true);
			
			// Make the panel compact
			panel.style.width = "320px";
			panel.style.height = "142px";
			
			modulePanels["Music"] = panel;
			document.body.appendChild(panel);

			// Create music player content
			createMusicPlayerContent(content);

			updateCategoryHighlights();
			saveGUIState();
		}

		// === Global Music Player State ===
		let globalMusicState = {
			currentTrack: null,
			audioElement: null,
			isPlaying: false,
			analyser: null,
			audioContext: null
		};

		// === Create Always-Visible Visualizer ===
		function createAlwaysVisibleVisualizer() {
			const container = document.createElement("div");
			container.id = "music-visualizer-container";
			container.style.cssText = `
				position: fixed;
				bottom: 0;
				left: 0;
				display: none;
				z-index: 9999;
				pointer-events: none;
			`;

			// Cover image - small, bottom-left corner
			const coverImg = document.createElement("img");
			coverImg.id = "visualizer-cover";
			coverImg.style.cssText = `
				position: fixed;
				bottom: 0;
				left: 0;
				width: 100px;
				height: 100px;
				object-fit: cover;
				pointer-events: auto;
			`;
			coverImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='0.3em' fill='%23888' font-size='30'%3E🎵%3C/text%3E%3C/svg%3E";

			// Canvas for visualizer - large, extends to center
			const canvas = document.createElement("canvas");
			canvas.id = "visualizer-canvas";
			canvas.width = 800;
			canvas.height = 100;
			canvas.style.cssText = `
				position: fixed;
				bottom: 0;
				left: 100px;
				width: 800px;
				height: 100px;
			`;

			container.appendChild(coverImg);
			container.appendChild(canvas);
			document.body.appendChild(container);

			return { container, canvas, coverImg };
		}

		const visualizerElements = createAlwaysVisibleVisualizer();

		// === Visualizer Animation ===
		function startVisualizer() {
			if (!globalMusicState.audioElement || !globalMusicState.analyser) return;

			const canvas = visualizerElements.canvas;
			const ctx = canvas.getContext("2d");
			const analyser = globalMusicState.analyser;
			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			function draw() {
				if (!globalMusicState.isPlaying) {
					// Clear canvas when not playing
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					return;
				}

				requestAnimationFrame(draw);
				analyser.getByteFrequencyData(dataArray);

				// Clear canvas (transparent background)
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				const barCount = 64;
				const barWidth = canvas.width / barCount;
				const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--vape-accent-color") || "#0FB3A0";

				for (let i = 0; i < barCount; i++) {
					const dataIndex = Math.floor((i / barCount) * bufferLength);
					const barHeight = (dataArray[dataIndex] / 255) * canvas.height * 0.9;
					
					const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
					gradient.addColorStop(0, accentColor);
					gradient.addColorStop(1, accentColor + "60");
					
					ctx.fillStyle = gradient;
					ctx.fillRect(
						i * barWidth + 1,
						canvas.height - barHeight,
						barWidth - 2,
						barHeight
					);
				}
			}

			draw();
		}

		// === Setup Audio Context and Analyser ===
		function setupAudioAnalyser(audioElement) {
			try {
				if (!globalMusicState.audioContext) {
					globalMusicState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
					console.log("AudioContext created");
				}

				// Only create analyser once
				if (!globalMusicState.analyser) {
					globalMusicState.analyser = globalMusicState.audioContext.createAnalyser();
					globalMusicState.analyser.fftSize = 256;
					console.log("Analyser created");
				}

				// Only create source once per audio element
				if (!audioElement._audioSource) {
					const source = globalMusicState.audioContext.createMediaElementSource(audioElement);
					source.connect(globalMusicState.analyser);
					globalMusicState.analyser.connect(globalMusicState.audioContext.destination);
					audioElement._audioSource = source;
					console.log("Audio source connected");
				}
			} catch (error) {
				console.error("Failed to setup audio analyser:", error);
			}
		}

		// === Create Music Player Content ===
		function createMusicPlayerContent(content) {
			const JAMENDO_API_KEY = "0c5e9d9e";
			
			// Use global state instead of local variables
			let currentTrack = globalMusicState.currentTrack;
			let audioElement = globalMusicState.audioElement;
			let isPlaying = globalMusicState.isPlaying;

			// Main container
			const playerContainer = document.createElement("div");
			playerContainer.style.cssText = `
				display: flex;
				padding: 8px;
				gap: 8px;
				height: 100%;
				color: var(--vape-text-color, #ffffff);
			`;

			// Left side - Album cover
			const coverContainer = document.createElement("div");
			coverContainer.style.cssText = `
				position: relative;
				width: 70px;
				height: 70px;
				background: #333;
				border-radius: 8px;
				overflow: hidden;
				cursor: pointer;
				flex-shrink: 0;
			`;

			const coverImage = document.createElement("img");
			coverImage.style.cssText = `
				width: 100%;
				height: 100%;
				object-fit: cover;
				transition: opacity 0.3s;
			`;
			coverImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23444'/%3E%3Ctext x='60' y='60' text-anchor='middle' dy='0.3em' fill='%23888' font-size='40'%3E🎵%3C/text%3E%3C/svg%3E";

			const searchOverlay = document.createElement("div");
			searchOverlay.style.cssText = `
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0,0,0,0.7);
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0;
				transition: opacity 0.3s;
				font-size: 24px;
			`;
			searchOverlay.innerHTML = "🔍";

			coverContainer.appendChild(coverImage);
			coverContainer.appendChild(searchOverlay);

			// Hover effect
			coverContainer.addEventListener("mouseenter", () => {
				searchOverlay.style.opacity = "1";
			});
			coverContainer.addEventListener("mouseleave", () => {
				searchOverlay.style.opacity = "0";
			});

			// Click to search
			coverContainer.addEventListener("click", () => {
				openMusicSearchModal();
			});

			// Right side - Controls and info
			const controlsContainer = document.createElement("div");
			controlsContainer.style.cssText = `
				flex: 1;
				display: flex;
				flex-direction: row;
				gap: 8px;
				align-items: center;
				min-width: 0;
			`;

			// Left part: Track info (vertical)
			const infoContainer = document.createElement("div");
			infoContainer.style.cssText = `
				flex: 1;
				display: flex;
				flex-direction: column;
				justify-content: center;
				min-width: 0;
			`;

			// Right part: Control buttons (fixed width)
			const buttonContainer = document.createElement("div");
			buttonContainer.style.cssText = `
				display: flex;
				gap: 8px;
				align-items: center;
				flex-shrink: 0;
			`;

			// Track info
			// Track info elements
			const trackTitle = document.createElement("div");
			trackTitle.style.cssText = `
				font-size: 12px;
				font-weight: bold;
				margin-bottom: 4px;
				color: var(--vape-accent-color, #0FB3A0);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			`;
			trackTitle.textContent = "No track selected";

			const trackArtist = document.createElement("div");
			trackArtist.style.cssText = `
				font-size: 10px;
				opacity: 0.7;
				margin-bottom: 4px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			`;
			trackArtist.textContent = "Click cover to search music";

			const trackDuration = document.createElement("div");
			trackDuration.style.cssText = `
				font-size: 9px;
				opacity: 0.5;
			`;
			trackDuration.textContent = "00:00 / 00:00";

			infoContainer.appendChild(trackTitle);
			infoContainer.appendChild(trackArtist);
			infoContainer.appendChild(trackDuration);

			// Control buttons
			let playButton = createControlButton("▶️", 36);

			buttonContainer.appendChild(playButton);

			controlsContainer.appendChild(infoContainer);
			controlsContainer.appendChild(buttonContainer);

			// Initialize UI with global state
			if (globalMusicState.currentTrack) {
				currentTrack = globalMusicState.currentTrack;
				audioElement = globalMusicState.audioElement;
				isPlaying = globalMusicState.isPlaying;
				
				if (trackTitle) trackTitle.textContent = currentTrack.name;
				if (trackArtist) trackArtist.textContent = currentTrack.artist_name;
				if (coverImage) coverImage.src = currentTrack.image || coverImage.src;
				if (playButton) playButton.textContent = isPlaying ? "⏸️" : "▶️";
				
				// Reconnect audio element event listeners for time updates
				if (audioElement) {
					// Remove old listeners if any
					audioElement.removeEventListener("timeupdate", audioElement._timeupdateHandler);
					
					// Create new handler
					audioElement._timeupdateHandler = () => {
						const current = formatTime(audioElement.currentTime || 0);
						const duration = formatTime(audioElement.duration || 0);
						if (trackDuration) trackDuration.textContent = `${current} / ${duration}`;
					};
					
					// Add new listener
					audioElement.addEventListener("timeupdate", audioElement._timeupdateHandler);
					
					// Update duration immediately
					if (audioElement.duration) {
						const current = formatTime(audioElement.currentTime || 0);
						const duration = formatTime(audioElement.duration || 0);
						if (trackDuration) trackDuration.textContent = `${current} / ${duration}`;
					}
				}
			}

			// Update functions to use current state
			function updatePlayButton() {
				if (playButton) {
					playButton.textContent = globalMusicState.isPlaying ? "⏸️" : "▶️";
				}
			}
			
			function formatTime(seconds) {
				if (!seconds || isNaN(seconds)) return "00:00";
				const mins = Math.floor(seconds / 60);
				const secs = Math.floor(seconds % 60);
				return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
			}

			playButton.addEventListener("click", () => {
				console.log("Play button clicked, globalState.isPlaying:", globalMusicState.isPlaying, "globalState.currentTrack:", globalMusicState.currentTrack);
				if (!globalMusicState.currentTrack) return;
				
				if (globalMusicState.isPlaying) {
					pauseTrack();
				} else {
					playTrack();
				}
			});

			playerContainer.appendChild(coverContainer);
			playerContainer.appendChild(controlsContainer);
			content.appendChild(playerContainer);

			// Helper functions
			function createControlButton(text, size) {
				const button = document.createElement("button");
				button.style.cssText = `
					background: transparent;
					border: 2px solid var(--vape-accent-color, #0FB3A0);
					border-radius: 50%;
					width: ${size}px;
					height: ${size}px;
					color: var(--vape-accent-color, #0FB3A0);
					cursor: pointer;
					font-size: ${size === 36 ? '16px' : '12px'};
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s;
					font-family: inherit;
				`;
				button.textContent = text;
				
				button.addEventListener("mouseenter", () => {
					button.style.transform = "scale(1.1)";
					button.style.background = "var(--vape-accent-color, #0FB3A0)";
					button.style.color = "white";
				});
				button.addEventListener("mouseleave", () => {
					button.style.transform = "scale(1)";
					button.style.background = "transparent";
					button.style.color = "var(--vape-accent-color, #0FB3A0)";
				});

				return button;
			}

			function playTrack() {
				if (!globalMusicState.audioElement || !globalMusicState.currentTrack) {
					console.log("No audio element or track in global state");
					return;
				}
				
				globalMusicState.audioElement.play().then(() => {
					globalMusicState.isPlaying = true;
					updatePlayButton();
					
					// Show visualizer and start animation
					visualizerElements.container.style.display = "block";
					startVisualizer();
					
					console.log("Playing:", globalMusicState.currentTrack.name);
				}).catch(error => {
					console.error("Play error:", error);
					if (trackDuration) trackDuration.textContent = "Play failed";
				});
			}

			function pauseTrack() {
				if (!globalMusicState.audioElement) return;
				
				globalMusicState.audioElement.pause();
				globalMusicState.isPlaying = false;
				updatePlayButton();
				console.log("Paused");
			}

			function loadTrack(track) {
				currentTrack = track;
				globalMusicState.currentTrack = track;
				
				// Update UI
				if (trackTitle) trackTitle.textContent = track.name;
				if (trackArtist) trackArtist.textContent = track.artist_name;
				if (coverImage) coverImage.src = track.image || coverImage.src;
				
				// Create audio element
				if (audioElement) {
					audioElement.pause();
					audioElement.src = "";
					audioElement = null;
				}
				
				// Get the correct audio URL from Jamendo
				const audioUrl = `https://prod-1.storage.jamendo.com/?trackid=${track.id}&format=mp31&from=app-97dab294`;
				
				audioElement = new Audio();
				globalMusicState.audioElement = audioElement;
				audioElement.crossOrigin = "anonymous";
				audioElement.preload = "metadata";
				
				audioElement.addEventListener("loadedmetadata", () => {
					const duration = formatTime(audioElement.duration || 0);
					if (trackDuration) trackDuration.textContent = `00:00 / ${duration}`;
					console.log("Track loaded:", track.name, "Duration:", audioElement.duration);
				});
				
				// Store handler for reconnection
				audioElement._timeupdateHandler = () => {
					const current = formatTime(audioElement.currentTime || 0);
					const duration = formatTime(audioElement.duration || 0);
					if (trackDuration) trackDuration.textContent = `${current} / ${duration}`;
				};
				audioElement.addEventListener("timeupdate", audioElement._timeupdateHandler);
				
				audioElement.addEventListener("ended", () => {
					globalMusicState.isPlaying = false;
					updatePlayButton();
				});
				
				audioElement.addEventListener("error", (e) => {
					console.error("Audio error:", e);
					if (trackDuration) trackDuration.textContent = "Error loading audio";
				});
				
				audioElement.addEventListener("canplay", () => {
					console.log("Audio can play");
				});
				
				// Set the source and load
				audioElement.src = audioUrl;
				audioElement.load();
				
				// Setup audio analyser for visualizer
				try {
					setupAudioAnalyser(audioElement);
				} catch (e) {
					console.error("Failed to setup audio analyser:", e);
				}
				
				// Update visualizer cover image
				if (visualizerElements.coverImg) {
					visualizerElements.coverImg.src = track.image || visualizerElements.coverImg.src;
				}
				
				// Reset play state
				globalMusicState.isPlaying = false;
				updatePlayButton();
			}

			// Music search modal
			function openMusicSearchModal() {
				// Prevent multiple modals
				if (document.querySelector('.music-search-modal')) {
					return;
				}

				// Create modal overlay
				const modalOverlay = document.createElement("div");
				modalOverlay.className = "music-search-modal";
				modalOverlay.style.cssText = `
					position: fixed;
					top: 0;
					left: 0;
					width: 100vw;
					height: 100vh;
					background: rgba(0,0,0,0.8);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 9999999;
				`;

				const modal = document.createElement("div");
				modal.style.cssText = `
					background: var(--vape-bg-color, #1a1a1a);
					border-radius: 12px;
					width: 500px;
					height: 400px;
					padding: 20px;
					color: var(--vape-text-color, #ffffff);
					display: flex;
					flex-direction: column;
				`;

				const modalHeader = document.createElement("div");
				modalHeader.style.cssText = `
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 20px;
				`;

				const modalTitle = document.createElement("h3");
				modalTitle.textContent = "Search Music";
				modalTitle.style.cssText = `
					margin: 0;
					color: var(--vape-accent-color, #0FB3A0);
				`;

				const closeButton = document.createElement("button");
				closeButton.textContent = "✕";
				closeButton.style.cssText = `
					background: none;
					border: none;
					color: var(--vape-text-color, #ffffff);
					font-size: 18px;
					cursor: pointer;
				`;
				closeButton.addEventListener("click", () => {
					document.body.removeChild(modalOverlay);
				});

				const searchInput = document.createElement("input");
				searchInput.type = "text";
				searchInput.placeholder = "Search for music...";
				searchInput.style.cssText = `
					width: 100%;
					padding: 10px;
					border: 1px solid #333;
					border-radius: 6px;
					background: #333;
					color: white;
					margin-bottom: 15px;
				`;

				const searchResults = document.createElement("div");
				searchResults.style.cssText = `
					flex: 1;
					overflow-y: auto;
					border: 1px solid #333;
					border-radius: 6px;
					padding: 10px;
				`;

				modalHeader.appendChild(modalTitle);
				modalHeader.appendChild(closeButton);
				modal.appendChild(modalHeader);
				modal.appendChild(searchInput);
				modal.appendChild(searchResults);
				modalOverlay.appendChild(modal);
				document.body.appendChild(modalOverlay);

				// Search functionality
				let searchTimeout;
				searchInput.addEventListener("input", () => {
					clearTimeout(searchTimeout);
					searchTimeout = setTimeout(() => {
						searchMusic(searchInput.value, searchResults, modalOverlay);
					}, 500);
				});

				// Close modal on overlay click
				modalOverlay.addEventListener("click", (e) => {
					if (e.target === modalOverlay) {
						document.body.removeChild(modalOverlay);
					}
				});

				// Close modal on Escape key
				const handleEscape = (e) => {
					if (e.key === "Escape") {
						document.body.removeChild(modalOverlay);
						document.removeEventListener("keydown", handleEscape);
					}
				};
				document.addEventListener("keydown", handleEscape);

				// Auto-focus search input
				setTimeout(() => searchInput.focus(), 100);
			}

			async function searchMusic(query, resultsContainer, modalOverlay) {
				if (!query.trim()) {
					resultsContainer.innerHTML = "<p style='opacity: 0.5; text-align: center;'>Enter a search term</p>";
					return;
				}

				resultsContainer.innerHTML = "<p style='opacity: 0.5; text-align: center;'>Searching...</p>";

				try {
					const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_API_KEY}&format=json&limit=10&search=${encodeURIComponent(query)}&include=musicinfo`);
					const data = await response.json();

					if (data.results && data.results.length > 0) {
						resultsContainer.innerHTML = "";
						data.results.forEach(track => {
							const resultItem = document.createElement("div");
							resultItem.style.cssText = `
								display: flex;
								align-items: center;
								gap: 10px;
								padding: 10px;
								border-radius: 6px;
								cursor: pointer;
								transition: background 0.2s;
								margin-bottom: 5px;
							`;

							resultItem.addEventListener("mouseenter", () => {
								resultItem.style.background = "rgba(255,255,255,0.1)";
							});
							resultItem.addEventListener("mouseleave", () => {
								resultItem.style.background = "transparent";
							});

							const trackImage = document.createElement("img");
							trackImage.src = track.image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23444'/%3E%3Ctext x='20' y='20' text-anchor='middle' dy='0.3em' fill='%23888' font-size='16'%3E🎵%3C/text%3E%3C/svg%3E";
							trackImage.style.cssText = `
								width: 40px;
								height: 40px;
								border-radius: 4px;
								object-fit: cover;
							`;

							const trackInfo = document.createElement("div");
							trackInfo.style.cssText = `
								flex: 1;
							`;

							const trackName = document.createElement("div");
							trackName.textContent = track.name;
							trackName.style.cssText = `
								font-weight: bold;
								margin-bottom: 2px;
							`;

							const artistName = document.createElement("div");
							artistName.textContent = track.artist_name;
							artistName.style.cssText = `
								opacity: 0.7;
								font-size: 12px;
							`;

							trackInfo.appendChild(trackName);
							trackInfo.appendChild(artistName);
							resultItem.appendChild(trackImage);
							resultItem.appendChild(trackInfo);

							resultItem.addEventListener("click", () => {
								loadTrack(track);
								// Close modal properly
								document.body.removeChild(modalOverlay);
							});

							resultsContainer.appendChild(resultItem);
						});
					} else {
						resultsContainer.innerHTML = "<p style='opacity: 0.5; text-align: center;'>No results found</p>";
					}
				} catch (error) {
					console.error("Search error:", error);
					resultsContainer.innerHTML = "<p style='opacity: 0.5; text-align: center; color: red;'>Search failed</p>";
				}
			}
		}

		// === Toggle ClickGUI ===
		let visible = false;
		// Use capture phase to ensure this runs before other listeners
		document.addEventListener("keydown", (e) => {
			if (e.code === "Backslash") {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
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
					if (typeof game !== 'undefined' && game?.canvas) {
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
		}, true); // Use capture phase to run before other listeners

		// === Startup notification ===
		setTimeout(() => { showNotif("Press \\\\ to open Impact V6 ClickGUI!", "info", 4000); }, 500);
	}
})();
