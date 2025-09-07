/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "5.0.0";

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
	addModification('Potions.jump.getId(),"5");', `
		let blocking = false;
		let sendYaw = false;
		let sendY = false;
		let breakStart = Date.now();
		let noMove = Date.now();

		let enabledModules = {};
		let modules = {};

		let keybindCallbacks = {};
		let keybindList = {};

		let tickLoop = {};
		let renderTickLoop = {};

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
	addModification('if(!x.canConnect){', 'x.errorMessage = x.errorMessage === "Could not join server. You are connected to a VPN or proxy. Please disconnect from it and refresh the page." ? "You\'re maybe IP banned or you\'re using a vpn " : x.errorMessage;');

	// DRAWING SETUP
	addModification('I(this,"glintTexture");', `
		I(this, "vapeTexture");
		I(this, "v4Texture");
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
			this.vapeTexture = await this.loader.loadAsync("${corsMoment("https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/logo.png")}");
			this.v4Texture = await this.loader.loadAsync("${corsMoment("https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/logov4.png")}");
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
			const colorOffset = (Date.now() / 4000);
			const posX = 15;
			const posY = 17;
			ctx$5.imageSmoothingEnabled = true;
			ctx$5.imageSmoothingQuality = "high";
			drawImage(ctx$5, textureManager.vapeTexture.image, posX, posY, 80, 21, \`HSL(\${(colorOffset % 1) * 360}, 100%, 50%)\`);
			drawImage(ctx$5, textureManager.v4Texture.image, posX + 81, posY + 1, 33, 18);

			let offset = 0;
			let stringList = [];
			for(const [module, value] of Object.entries(enabledModules)) {
				if (!value || module == "TextGUI") continue;
				stringList.push(module);
			}

			stringList.sort(function(a, b) {
				const compA = ctx$5.measureText(a).width;
				const compB = ctx$5.measureText(b).width;
				return compA < compB ? 1 : -1;
			});

			for(const module of stringList) {
				offset++;
				drawText(ctx$5, module, posX + 6, posY + 12 + ((textguisize[1] + 3) * offset), textguisize[1] + "px " + textguifont[1], \`HSL(\${((colorOffset - (0.025 * offset)) % 1) * 360}, 100%, 50%)\`, "left", "top", 1, textguishadow[1]);
			}
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
			if (typeof game !== "undefined" && game.requestQueue) game.requestQueue();
		}
	`);
	addModification('ClientSocket.on("CPacketUpdateStatus",h=>{', `
		if (h.rank && h.rank != "" && RANK.LEVEL[$.rank].permLevel > 2) {
			if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
				game.chat.addChat({
					text: "STAFF DETECTED : " + h.rank + "\\n".repeat(10),
					color: "red"
				});
			}
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

	// STEP
	addModification('p.y=this.stepHeight;', 'p.y=(enabledModules["Step"]?Math.max(stepheight[1],this.stepHeight):this.stepHeight);', true);

	// WTAP
	addModification('this.dead||this.getHealth()<=0)return;', `
		if (enabledModules["WTap"]) player.serverSprintState = false;
	`);

	// FASTBREAK
	addModification('u&&player.mode.isCreative()', `||enabledModules["FastBreak"]`);

	// INVWALK
	addModification('keyPressed(m)&&Game.isActive(!1)', 'keyPressed(m)&&(Game.isActive(!1)||enabledModules["InvWalk"]&&!(typeof game !== "undefined" && game.chat && game.chat.showInput))', true);

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

	// CHAMS
	addModification(')&&(p.mesh.visible=this.shouldRenderEntity(p))', `
		if (enabledModules["Chams"] && p && p.id != player.id) {
			for(const mesh in p.mesh.meshes) {
				p.mesh.meshes[mesh].material.depthTest = false;
				p.mesh.meshes[mesh].renderOrder = 3;
			}

			for(const mesh in p.mesh.armorMesh) {
				p.mesh.armorMesh[mesh].material.depthTest = false;
				p.mesh.armorMesh[mesh].renderOrder = 4;
			}

			if (p.mesh.capeMesh) {
				p.mesh.capeMesh.children[0].material.depthTest = false;
				p.mesh.capeMesh.children[0].renderOrder = 5;
			}

			if (p.mesh.hatMesh) {
				for(const mesh of p.mesh.hatMesh.children[0].children) {
					if (!mesh.material) continue;
					mesh.material.depthTest = false;
					mesh.renderOrder = 4;
				}
			}
		}
	`);


	// LOGIN BYPASS
	addModification('new SPacketLoginStart({requestedUuid:localStorage.getItem(REQUESTED_UUID_KEY)??void 0,session:localStorage.getItem(SESSION_TOKEN_KEY)??"",hydration:localStorage.getItem("hydration")??"0",metricsId:localStorage.getItem("metrics_id")??"",clientVersion:VERSION$1})', 'new SPacketLoginStart({requestedUuid:void 0,session:(enabledModules["AntiBan"] ? "" : (localStorage.getItem(SESSION_TOKEN_KEY) ?? "")),hydration:"0",metricsId:uuid$1(),clientVersion:VERSION$1})', true);

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
						if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
							game.chat.addChat({
								text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
								color: module.enabled ? "lime" : "red"
							});
						}
					}
					else if (args[1] == "all") {
						for(const [name, module] of Object.entries(modules)) module.toggle();
					}
				}
				return this.closeInput();
			case ".modules":
				chatString = "Module List\\n";
				for(const [name, module] of Object.entries(modules)) chatString += "\\n" + name;
				if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
					game.chat.addChat({text: chatString});
				}
				return this.closeInput();
			case ".binds":
				chatString = "Bind List\\n";
				for(const [name, module] of Object.entries(modules)) chatString += "\\n" + name + " : " + (module.bind != "" ? module.bind : "none");
				if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
					game.chat.addChat({text: chatString});
				}
				return this.closeInput();
			case ".setoption":
			case ".reset": {
				const module = args.length > 1 && getModule(args[1]);
				const reset = args[0] == ".reset";
				if (module) {
					if (args.length < 3) {
						chatString = module.name + " Options";
						for(const [name, value] of Object.entries(module.options)) chatString += "\\n" + name + " : " + value[0].name + " : " + value[1];
						if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
							game.chat.addChat({text: chatString});
						}
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
						if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
							game.chat.addChat({text: "Reset " + module.name + " " + option[2] + " to " + option[1]});
						}
						return this.closeInput();
					}
					if (option[0] == Number) option[1] = !isNaN(Number.parseFloat(args[3])) ? Number.parseFloat(args[3]) : option[1];
					else if (option[0] == Boolean) option[1] = args[3] == "true";
					else if (option[0] == String) option[1] = args.slice(3).join(" ");
					if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
						game.chat.addChat({text: "Set " + module.name + " " + option[2] + " to " + option[1]});
					}
				}
				return this.closeInput();
			}
			case ".config":
			case ".profile":
				if (args.length > 1) {
					switch (args[1]) {
						case "save":
							globalThis.${storeName}.saveVapeConfig(args[2]);
							if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
								game.chat.addChat({text: "Saved config " + args[2]});
							}
							break;
						case "load":
							globalThis.${storeName}.saveVapeConfig();
							globalThis.${storeName}.loadVapeConfig(args[2]);
							if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
								game.chat.addChat({text: "Loaded config " + args[2]});
							}
							break;
						case "import":
							globalThis.${storeName}.importVapeConfig(args[2]);
							if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
								game.chat.addChat({text: "Imported config"});
							}
							break;
						case "export":
							globalThis.${storeName}.exportVapeConfig();
							if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
								game.chat.addChat({text: "Config set to clipboard!"});
							}
							break;
					}
				}
				return this.closeInput();
		}
		if (enabledModules["FilterBypass"] && !this.inputValue.startsWith('/')) {
			const words = this.inputValue.split(" ");
			let newwords = [];
			for(const word of words) newwords.push(word.charAt(0) + '‎' + word.slice(1));
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
		// my code lol
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
					if (manual && typeof game !== "undefined" && game.chat && game.chat.addChat) {
						game.chat.addChat({text: "Bound " + this.name + " to " + (key == "" ? "none" : key) + "!"});
					}
					if (key == "") return;
					const module = this;
					keybindCallbacks[this.bind] = function(j) {
						if (Game.isActive()) {
							module.toggle();
							if (typeof game !== "undefined" && game.chat && game.chat.addChat) {
								game.chat.addChat({
									text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
									color: module.enabled ? "lime" : "red"
								});
							}
						}
					};
				}
				addoption(name, typee, defaultt) {
					this.options[name] = [typee, defaultt, name, defaultt];
					return this.options[name];
				}
			}

			function reloadTickLoop(value) {
				if (typeof game !== "undefined" && game.tickLoop) {
					MSPT = value;
					clearInterval(game.tickLoop);
					game.tickLoop = setInterval(() => game.fixedUpdate(), MSPT);
				}
			}

			//<MODULES_HERE>
			
			globalThis.${storeName}.modules = modules;
			globalThis.${storeName}.profile = "default";
		})();
	`);

	async function saveVapeConfig(profile) {
		if (!loadedConfig || !unsafeWindow.globalThis[storeName] || !unsafeWindow.globalThis[storeName].modules) return;
		let saveList = {};
		for(const [name, module] of Object.entries(unsafeWindow.globalThis[storeName].modules)) {
			saveList[name] = {enabled: module.enabled, bind: module.bind, options: {}};
			for(const [option, setting] of Object.entries(module.options)) {
				saveList[name].options[option] = setting[1];
			}
		}
		GM_setValue("vapeConfig" + (profile ?? unsafeWindow.globalThis[storeName].profile), JSON.stringify(saveList));
		GM_setValue("mainVapeConfig", JSON.stringify({profile: unsafeWindow.globalThis[storeName].profile}));
	}

	async function loadVapeConfig(switched) {
		if (!unsafeWindow.globalThis[storeName] || !unsafeWindow.globalThis[storeName].modules) return;
		loadedConfig = false;
		const loadedMain = JSON.parse(await GM_getValue("mainVapeConfig", "{}")) ?? {profile: "default"};
		unsafeWindow.globalThis[storeName].profile = switched ?? loadedMain.profile;
		const loaded = JSON.parse(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
		for(const [name, module] of Object.entries(unsafeWindow.globalThis[storeName].modules)) {
			if (loaded[name]) {
				if (loaded[name].enabled) module.toggle();
				module.setbind(loaded[name].bind ?? "");
				for(const [option, setting] of Object.entries(loaded[name].options ?? {})) {
					if (module.options[option]) {
						module.options[option][1] = setting;
					}
				}
			}
		}
		loadedConfig = true;
	}

	async function exportVapeConfig() {
		if (!unsafeWindow.globalThis[storeName]) return;
		navigator.clipboard.writeText(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
	}

	async function importVapeConfig() {
		if (!unsafeWindow.globalThis[storeName]) return;
		const arg = await navigator.clipboard.readText();
		if (!arg) return;
		GM_setValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, arg);
		loadVapeConfig();
	}

	let loadedConfig = false;
	if (typeof GM_getValue !== "undefined") {
		document.addEventListener("DOMContentLoaded", function() {
			setTimeout(function() {
				console.log("Vape config system initialized!");
			}, 10);
		});
		
		// Initialize globalThis store if it doesn't exist
		if (!unsafeWindow.globalThis[storeName]) {
			unsafeWindow.globalThis[storeName] = {};
		}
		
		unsafeWindow.globalThis[storeName].saveVapeConfig = saveVapeConfig;
		unsafeWindow.globalThis[storeName].loadVapeConfig = loadVapeConfig;
		unsafeWindow.globalThis[storeName].exportVapeConfig = exportVapeConfig;
		unsafeWindow.globalThis[storeName].importVapeConfig = importVapeConfig;
		
		// Wait for modules to be available before loading config
		const configLoop = setInterval(() => {
			if (unsafeWindow.globalThis[storeName].modules) {
				clearInterval(configLoop);
				loadVapeConfig();
			}
		}, 100);
		
		setInterval(async function() {
			if (unsafeWindow.globalThis[storeName].modules) {
				saveVapeConfig();
			}
		}, 10000);
	}
	
})();

(async function () {
  try {
    // Loads the Minecraft Font onto GUI
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.cdnfonts.com/css/minecraft-4";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    // Wait for Modules!
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
    console.error("[ClickGUI] Init failed:", err);
  }

  function injectGUI(store) {
    const categories = {
      Combat: ["autoclicker", "killaura", "velocity", "wtap"],
      Movement: [
        "scaffold","jesus","phase","nofall","sprint","keepsprint","step",
        "speed","fly","noslowdown","spiderclimb","jetpack"
      ],
      "Player / Render": [
        "invcleaner","invwalk","autoarmor","ghostjoin",
        "playeresp","nametags+","textgui","clickgui"
      ],
      World: ["fastbreak","breaker","autocraft","cheststeal","timer"],
      Utility: [
        "autorespawn","autorejoin","autoqueue",
        "autovote","filterbypass","anticheat",
        "autofunnychat","musicfix","auto-funnychat","music-fix"
      ]
    };

    const catIcons = {
      Combat: "⚔️",
      Movement: "🏃",
      "Player / Render": "🧑👁️",
      World: "🌍",
      Utility: "🛠️"
    };

    // === Notification System ===
    const notifWrap = document.createElement("div");
    notifWrap.className = "notif-wrap";
    document.body.appendChild(notifWrap);

    function showNotif(msg, dur = 3000) {
      const n = document.createElement("div");
      n.className = "notif";
      n.textContent = msg;
      notifWrap.appendChild(n);
      setTimeout(() => (n.style.transform = "translateX(0)"), 30);
      setTimeout(() => {
        n.style.opacity = "0";
        n.style.transform = "translateX(120%)";
      }, dur);
      setTimeout(() => n.remove(), dur + 400);
    }

    // === Styles (LiquidBounce Theme + Scrollbars) ===
    const style = document.createElement("style");
    style.textContent = 
      "@keyframes guiEnter {0%{opacity:0;transform:scale(0.9);}100%{opacity:1;transform:scale(1);}}" +
      ".notif-wrap {" +
        "position:fixed;" +
        "top:10px;" +
        "right:10px;" +
        "z-index:100002;" +
        "pointer-events:none;" +
      "}" +
      ".notif {" +
        "background:#111;" +
        "border:2px solid #00aaff;" +
        "color:white;" +
        "padding:8px 12px;" +
        "margin-bottom:5px;" +
        "font-family:monospace;" +
        "font-size:12px;" +
        "transform:translateX(120%);" +
        "transition:all 0.3s ease;" +
        "opacity:1;" +
      "}" +
      ".lb-panel {" +
        "position:absolute;" +
        "width:220px;" +
        "background:#111;" +
        "border:2px solid #00aaff;" +
        "border-radius:0;" +
        "font-family:monospace;" +
        "color:white;" +
        "animation:guiEnter .25s ease-out;" +
        "z-index:100000;" +
        "max-height:420px;" +
        "overflow-y:auto;" +
        "overflow-x:hidden;" +
      "}" +
      ".lb-panel::-webkit-scrollbar { width:6px; }" +
      ".lb-panel::-webkit-scrollbar-thumb { background:#00aaff; }" +
      ".lb-panel::-webkit-scrollbar-track { background:#111; }" +
      ".lb-header {" +
        "background:#0a0a0a;" +
        "padding:6px;" +
        "font-weight:bold;" +
        "cursor:move;" +
        "user-select:none;" +
        "text-align:center;" +
        "border-bottom:1px solid #00aaff;" +
      "}" +
      ".lb-module {" +
        "padding:4px 8px;" +
        "cursor:pointer;" +
        "transition:background .15s;" +
        "border-bottom:1px solid #222;" +
        "display:flex;" +
        "justify-content:space-between;" +
        "align-items:center;" +
      "}" +
      ".lb-module:hover { background:#222; }" +
      ".lb-module.enabled { background:#003366; color:#00aaff; }" +
      ".lb-module.enabled:hover { background:#004488; }" +
      ".lb-bind { font-size:10px; color:#666; }" +
      ".lb-settings {" +
        "margin-left:8px;" +
        "padding:2px 6px;" +
        "background:#333;" +
        "border:1px solid #555;" +
        "font-size:10px;" +
        "cursor:pointer;" +
      "}" +
      ".lb-settings:hover { background:#444; }" +
      ".lb-option {" +
        "padding:3px 12px;" +
        "background:#1a1a1a;" +
        "border-bottom:1px solid #333;" +
        "font-size:11px;" +
      "}" +
      ".lb-option input {" +
        "background:#333;" +
        "border:1px solid #555;" +
        "color:white;" +
        "padding:2px 4px;" +
        "width:60px;" +
        "margin-left:8px;" +
      "}" +
      ".lb-option input[type='checkbox'] { width:auto; }" +
      ".lb-searchwrap {" +
        "position:fixed;" +
        "top:10px;" +
        "right:10px;" +
        "z-index:100001;" +
      "}" +
      ".lb-search {" +
        "background:#111;" +
        "border:2px solid #00aaff;" +
        "color:white;" +
        "padding:6px;" +
        "font-family:monospace;" +
        "outline:none;" +
      "}";
    document.head.appendChild(style);

    let panels = {};
    let dragData = null;

    // === Create Panel ===
    function createPanel(category, x = 50, y = 50) {
      if (panels[category]) return panels[category];

      const panel = document.createElement("div");
      panel.className = "lb-panel";
      panel.style.left = x + "px";
      panel.style.top = y + "px";

      const header = document.createElement("div");
      header.className = "lb-header";
      header.textContent = catIcons[category] + " " + category;
      panel.appendChild(header);

      // Make draggable
      header.addEventListener("mousedown", (e) => {
        dragData = {
          panel,
          offsetX: e.clientX - panel.offsetLeft,
          offsetY: e.clientY - panel.offsetTop
        };
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

        panel.appendChild(moduleDiv);
      });

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
        optionDiv.innerHTML = name + ": ";

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
            option[1] = option[0] === Number ? parseFloat(input.value) || 0 : input.value;
          });
          optionDiv.appendChild(input);
        }

        moduleDiv.parentNode.insertBefore(optionDiv, moduleDiv.nextSibling);
      });
    }

    // === Mouse Events ===
    document.addEventListener("mousemove", (e) => {
      if (dragData) {
        dragData.panel.style.left = (e.clientX - dragData.offsetX) + "px";
        dragData.panel.style.top = (e.clientY - dragData.offsetY) + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      if (dragData) {
        const category = Object.keys(panels).find(key => panels[key] === dragData.panel);
        if (category) {
          localStorage.setItem("lb-pos-" + category, JSON.stringify({
            x: parseInt(dragData.panel.style.left),
            y: parseInt(dragData.panel.style.top)
          }));
        }
      }
      dragData = null;
    });

    // === Create Panels ===
    Object.keys(categories).forEach((category, index) => {
      const saved = JSON.parse(localStorage.getItem("lb-pos-" + category) || "{}");
      createPanel(category, saved.x || (50 + index * 240), saved.y || 50);
    });

    // === Reset Config ===
    const resetConfigRow = document.createElement("div");
    resetConfigRow.className = "lb-module";
    resetConfigRow.style.justifyContent = "flex-start";
    resetConfigRow.style.paddingLeft = "6px";
    resetConfigRow.style.fontWeight = "bold";
    resetConfigRow.style.color = "red";
    resetConfigRow.textContent = "⛔ Reset Config?";
    resetConfigRow.addEventListener("click", () => {
      localStorage.removeItem("lb-mods");
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lb-pos-"))
        .forEach((k) => localStorage.removeItem(k));
      alert("Config has been reset!");
      location.reload();
    });
    panels["Utility"].appendChild(resetConfigRow);

    // === Global Search ===
    const searchWrap = document.createElement("div");
    searchWrap.className = "lb-searchwrap";
    searchWrap.innerHTML = "<input type=\"text\" class=\"lb-search\" placeholder=\"Search..\">";
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

    // === Startup notification ===
    setTimeout(() => { showNotif("[ClickGUI] Press 'RightArrow' to open GUI", 4000); }, 500);

    // === Toggle the LB GUI ===
    let visible = false;
    document.addEventListener("keydown", (e) => {
      if (e.code === "ArrowRight") {
        visible = !visible;
        Object.values(panels).forEach((p)=> (p.style.display=visible?"block":"none"));
        searchWrap.style.display = visible ? "block":"none";
      }
    });
  }
})();
