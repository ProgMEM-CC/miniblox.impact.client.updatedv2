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
		for (const [name, module] of Object.entries(unsafeWindow.globalThis[storeName].modules)) {
			saveList[name] = { enabled: module.enabled, bind: module.bind, options: {} };
			for (const [option, setting] of Object.entries(module.options)) {
				saveList[name].options[option] = setting[1];
			}
		}
		GM_setValue("vapeConfig" + (profile ?? unsafeWindow.globalThis[storeName].profile), JSON.stringify(saveList));
		GM_setValue("mainVapeConfig", JSON.stringify({ profile: unsafeWindow.globalThis[storeName].profile }));
	}

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
	}

	async function exportVapeConfig() {
		navigator.clipboard.writeText(await GM_getValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, "{}"));
	}

	async function importVapeConfig() {
		const arg = await navigator.clipboard.readText();
		if (!arg) return;
		GM_setValue("vapeConfig" + unsafeWindow.globalThis[storeName].profile, arg);
		loadVapeConfig();
	}

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
		console.error("[ClickGUI] Init failed:", err);          // Checks for errors
	}

	function injectGUI(store) {
		const categories = {
			Combat: ["autoclicker", "killaura", "velocity", "wtap"],
			Movement: [
				"scaffold", "jesus", "phase", "nofall", "sprint", "keepsprint", "step",
				"speed", "fly", "noslowdown", "spiderclimb", "jetpack"
			],
			"Player / Render": [
				"invcleaner", "invwalk", "autoarmor", "ghostjoin",
				"playeresp", "nametags+", "textgui", "clickgui"
			],
			World: ["fastbreak", "breaker", "autocraft", "cheststeal", "timer"],
			Utility: [
				"autorespawn", "autorejoin", "autoqueue",
				"autovote", "filterbypass", "anticheat",
				"autofunnychat", "musicfix", "auto-funnychat", "music-fix"         // AutoFunnyChat doesnt enable properly but it works perfectly fine (disable) dont worry
			]
		};

		const catIcons = {
			Combat: "⚔️",
			Movement: "🏃",
			"Player / Render": "🧑👁️",
			World: "🌍",
			Utility: "🛠️"
		};

		// === Styles (LiquidBounce Theme + Scrollbars) ===
		const style = document.createElement("style");
		style.textContent = `
      @keyframes guiEnter {0%{opacity:0;transform:scale(0.9);}100%{opacity:1;transform:scale(1);}}
      .lb-panel {
        position:absolute;
        width:220px;
        background:#111;
        border:2px solid #00aaff;
        border-radius:0;
        font-family:"Minecraft", monospace;
        color:white;
        animation:guiEnter .25s ease-out;
        z-index:100000;

        /* Scrollable */
        max-height:420px;
        overflow-y:auto;
        overflow-x:hidden;
      }
      .lb-panel::-webkit-scrollbar { width:6px; }
      .lb-panel::-webkit-scrollbar-thumb { background:#00aaff; }
      .lb-panel::-webkit-scrollbar-track { background:#111; }
      .lb-header {
        background:#0a0a0a;
        padding:6px;
        font-weight:bold;
        cursor:move;
        user-select:none;
        text-align:center;
        border-bottom:1px solid #00aaff;
        color:white;
      }
      .lb-module {
        padding:4px 6px;
        border-bottom:1px solid #1b1b1b;
        display:flex;
        justify-content:space-between;
        align-items:center;
        cursor:pointer;
      }
      .lb-module:hover { background:#151a20; }
      .lb-module.active { color:#00aaff; }
      .lb-options {
        display:none;
        flex-direction:column;
        gap:4px;
        padding:4px 6px;
        background:#0f0f12;
        border-top:1px dashed #1e1e1e;
      }
      .lb-options.show { display:flex; animation:guiEnter .2s ease-out; }
      .lb-options label {
        font-size:12px;
        display:flex;
        justify-content:space-between;
        color:white;
      }
      .lb-options input[type="range"] { flex:1; margin-left:4px; }
      .lb-options input[type="text"] {
        flex:1;
        margin-left:4px;
        font-size:12px;
        background:#0a0a0a;
        color:white;
        border:1px solid #00aaff;
        font-family:"Minecraft", monospace;
        padding:2px;
      }
      .notif-wrap {
        position:fixed; bottom:40px; right:30px;
        display:flex; flex-direction:column; align-items:flex-end;
        pointer-events:none; z-index:999999;
      }
      .notif {
        background:#0a0a0a;
        color:white;
        padding:8px 12px;
        margin-top:6px;
        border:2px solid #00aaff;
        border-radius:0;
        font-family:"Minecraft", monospace;
        opacity:1;
        transform:translateX(120%);
        transition:opacity .3s, transform .3s ease;
      }
      .lb-searchwrap {
        position:fixed;
        top:15px;
        left:50%;
        transform:translateX(-50%);
        z-index:100001;
        background:#0a0a0a;
        border:2px solid #00aaff;
        border-radius:0;
        padding:4px 6px;
        font-family:"Minecraft", monospace;
      }
      .lb-search {
        background:#111;
        border:none;
        outline:none;
        color:white;
        font-size:13px;
        width:180px;
        font-family:"Minecraft", monospace;
      }
      .lb-search::placeholder { color:#00aaff; opacity:0.6; }
    `;
		document.head.appendChild(style);

		// === Notifications ===
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

		// === Persistence Helpers ===
		function saveModuleState(name, mod) {
			const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
			const opts = {};
			if (mod.options) {
				Object.entries(mod.options).forEach(([key, opt]) => {
					opts[key] = opt[1];
				});
			}
			saved[name] = { enabled: mod.enabled, bind: mod.bind, options: opts };
			localStorage.setItem("lb-mods", JSON.stringify(saved));
		}

		function loadModuleState(name, mod) {
			const saved = JSON.parse(localStorage.getItem("lb-mods") || "{}");
			if (saved[name]) {
				if (saved[name].enabled !== mod.enabled && typeof mod.toggle === "function") {
					mod.toggle();
				}
				if (saved[name].bind) {
					mod.setbind(saved[name].bind);
				}
				if (saved[name].options && mod.options) {
					Object.entries(saved[name].options).forEach(([key, val]) => {
						if (mod.options[key]) mod.options[key][1] = val;
					});
				}
			}
		}

		// === Panels ===
		const panels = {};
		Object.keys(categories).forEach((cat, i) => {
			const panel = document.createElement("div");
			panel.className = "lb-panel";
			panel.style.left = 40 + i * 240 + "px";
			panel.style.top = "100px";

			const header = document.createElement("div");
			header.className = "lb-header";
			header.textContent = `${catIcons[cat]} ${cat}`;
			panel.appendChild(header);

			// Restore saved pos
			const saved = localStorage.getItem("lb-pos-" + cat);
			if (saved) {
				const { left, top } = JSON.parse(saved);
				panel.style.left = left;
				panel.style.top = top;
			}

			// Dragging
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
					localStorage.setItem("lb-pos-" + cat,
						JSON.stringify({ left: panel.style.left, top: panel.style.top })
					);
				}
			});

			panels[cat] = panel;
			document.body.appendChild(panel);
		});

		// === Modules ===
		Object.entries(store.modules).forEach(([name, mod]) => {
			console.log("[ClickGUI] Found module:", name);

			let cat = "Utility";
			const lowerName = name.toLowerCase();
			for (const [c, keys] of Object.entries(categories)) {
				if (keys.some((k) => lowerName.includes(k))) {
					cat = c; break;
				}
			}

			// Restore state
			loadModuleState(name, mod);

			const row = document.createElement("div");
			row.className = "lb-module" + (mod.enabled ? " active" : "");
			row.innerHTML = `<span>${name}</span><span>${mod.enabled ? "ON" : "OFF"}</span>`;

			const optionsBox = document.createElement("div");
			optionsBox.className = "lb-options";

			// Toggle
			row.addEventListener("mousedown", (e) => {
				if (e.button === 0) {
					if (typeof mod.toggle === "function") mod.toggle();
					row.classList.toggle("active", mod.enabled);
					row.lastChild.textContent = mod.enabled ? "ON" : "OFF";
					showNotif(`${name} ${mod.enabled ? "enabled ✅" : "disabled ❌"}`);
					saveModuleState(name, mod);
				}
			});

			// Expand
			row.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				optionsBox.classList.toggle("show");
			});

			// Options UI
			if (mod.options) {
				Object.entries(mod.options).forEach(([key, opt]) => {
					const [type, val, label] = opt;
					const line = document.createElement("label");
					line.textContent = label;

					if (type === Boolean) {
						const cb = document.createElement("input");
						cb.type = "checkbox"; cb.checked = val;
						cb.onchange = () => {
							opt[1] = cb.checked;
							saveModuleState(name, mod);
						};
						line.appendChild(cb);
					} else if (type === Number) {
						const slider = document.createElement("input");
						slider.type = "range";
						const [min, max, step] = opt.range ?? [0, 10, 0.1];
						slider.min = min; slider.max = max; slider.step = step; slider.value = val;
						slider.oninput = () => {
							opt[1] = parseFloat(slider.value);
							saveModuleState(name, mod);
						};
						line.appendChild(slider);
					} else if (type === String) {
						const input = document.createElement("input");
						input.type = "text"; input.value = val;
						input.onchange = () => {
							opt[1] = input.value;
							saveModuleState(name, mod);
						};
						line.appendChild(input);
					}
					optionsBox.appendChild(line);
				});
			}

			// Keybind
			const bindLine = document.createElement("label");
			bindLine.textContent = "Bind:";
			const bindInput = document.createElement("input");
			bindInput.type = "text"; bindInput.value = mod.bind;
			bindInput.style.width = "70px";
			bindInput.style.background = "#0a0a0a";
			bindInput.style.color = "white";
			bindInput.style.border = "1px solid #00aaff";
			bindInput.style.fontFamily = '"Minecraft", monospace';
			bindInput.style.fontSize = "12px";
			bindInput.style.padding = "2px";
			bindInput.onchange = (e) => {
				mod.setbind(e.target.value);
				showNotif(`${name} bind set to ${e.target.value}`);
				saveModuleState(name, mod);
			};
			bindLine.appendChild(bindInput);
			optionsBox.appendChild(bindLine);

			panels[cat].appendChild(row);
			panels[cat].appendChild(optionsBox);
		});

		// === Reset Layout ===
		const resetRow = document.createElement("div");
		resetRow.className = "lb-module";
		resetRow.style.justifyContent = "flex-start";
		resetRow.style.paddingLeft = "6px";
		resetRow.style.fontWeight = "bold";
		resetRow.style.color = "#00aaff";
		resetRow.textContent = "↺ Reset Layout";
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
			showNotif("Layout reset to default positions ✅");
		});
		panels["Utility"].appendChild(resetRow);

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
		searchWrap.innerHTML = `<input type="text" class="lb-search" placeholder="Search..">`;
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
		setTimeout(() => { showNotif("[ClickGUI] Press '\\\\' to open GUI", 4000); }, 500);

		// === Toggle the LB GUI ===
		let visible = false;
		document.addEventListener("keydown", (e) => {
			if (e.code === "Backslash") {
				visible = !visible;
				Object.values(panels).forEach((p) => (p.style.display = visible ? "block" : "none"));
				searchWrap.style.display = visible ? "block" : "none";
			}
		});
	}
})();
