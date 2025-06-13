/**
 * @type {Record<string | RegExp, string>}
 */
let replacements = {};
let dumpedVarNames = {};
const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "1.1.5";

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

			// NoFall
			new Module("NoFall", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["NoFall"] = function() {
        				const ray = rayTraceBlocks(player.getEyePos(), player.getEyePos().clone().setY(0), false, false, false, game.world);
						if (player.fallDistance > 2.5 && ray) {
							ClientSocket.sendPacket(new SPacketPlayerPosLook({pos: {x: player.pos.x, y: ray.hitVec.y, z: player.pos.z}, onGround: true}));
							player.fallDistance = 0;
						}
					};
				}
				else delete tickLoop["NoFall"];
			});

			// WTap
			new Module("WTap", function() {});

			// AntiVoid
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
			let attackList = [];
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

						attackList = [];
						if (!killauraitem[1] || swordCheck()) {
							for (const entity of entities.values()) {
								if (entity.id == player.id) continue;
								const newDist = player.getDistanceSqToEntity(entity);
								if (newDist < (killaurarange[1] * killaurarange[1]) && entity instanceof EntityPlayer) {
									if (entity.mode.isSpectator() || entity.mode.isCreative() || entity.isInvisibleDump()) continue;
									if (localTeam && localTeam == getTeam(entity)) continue;
									if (killaurawall[1] && !player.canEntityBeSeen(entity)) continue;
									attackList.push(entity);
								}
							}
						}

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
				if (callback) {
					let ticks = 0;
					tickLoop["Fly"] = function() {
						ticks++;
						const dir = getMoveDirection(flyvalue[1]);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						player.motion.y = keyPressedDump("space") ? flyvert[1] : (keyPressedDump("shift") ? -flyvert[1] : 0);
					};
				}
				else {
					delete tickLoop["Fly"];
					if (player) {
						player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
						player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
					}
				}
			});
			flybypass = fly.addoption("Bypass", Boolean, true);
			flyvalue = fly.addoption("Speed", Number, 2);
			flyvert = fly.addoption("Vertical", Number, 0.7);

			// InfiniteFly
			let infiniteFlyVert;
			const infiniteFly = new Module("InfiniteFly", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["InfiniteFly"] = function() {
						ticks++;
						const dir = getMoveDirection(0.2);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						const goUp = keyPressedDump("space");
						const goDown = keyPressedDump("shift");
						if (goUp || goDown) {
							player.motion.y = goUp ? infiniteFlyVert[1] : -infiniteFlyVert[1];
						} else {
							player.motion.y = 0;
						}
					};
				}
				else {
					delete tickLoop["InfiniteFly"];
					if (player) {
						player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
						player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
					}
				}
			});
			infiniteFlyVert = infiniteFly.addoption("Vertical", Number, 0.3);

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

			new Module("Chams", function() {});
			const textgui = new Module("TextGUI", function() {});
			textguifont = textgui.addoption("Font", String, "Arial");
			textguisize = textgui.addoption("TextSize", Number, 15);
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


			function getPossibleSides(pos) {
				for(const side of EnumFacing.VALUES) {
					const state = game.world.getBlockState(pos.add(side.toVector().x, side.toVector().y, side.toVector().z));
					if (state.getBlock().material != Materials.air) return side.getOpposite();
				}
			}

			function switchSlot(slot) {
				player.inventory.currentItem = slot;
				game.info.selectedSlot = slot;
			}

			let scaffoldtower, oldHeld, scaffoldextend;
			const scaffold = new Module("Scaffold", function(callback) {
				if (callback) {
					if (player) oldHeld = game.info.selectedSlot;
					tickLoop["Scaffold"] = function() {
						for(let i = 0; i < 9; i++) {
							const item = player.inventory.main[i];
							if (item && item.item instanceof ItemBlock && item.item.block.getBoundingBox().max.y == 1 && item.item.name != "tnt") {
								switchSlot(i);
								break;
							}
						}

						const item = player.inventory.getCurrentItem();
						if (item && item.getItem() instanceof ItemBlock) {
							let placeSide;
							let pos = new BlockPos(player.pos.x, player.pos.y - 1, player.pos.z);
							if (game.world.getBlockState(pos).getBlock().material == Materials.air) {
								placeSide = getPossibleSides(pos);
								if (!placeSide) {
									let closestSide, closestPos;
									let closest = 999;
									for(let x = -5; x < 5; ++x) {
										for (let z = -5; z < 5; ++z) {
											const newPos = new BlockPos(pos.x + x, pos.y, pos.z + z);
											const checkNearby = getPossibleSides(newPos);
											if (checkNearby) {
												const newDist = player.pos.distanceTo(new Vector3$1(newPos.x, newPos.y, newPos.z));
												if (newDist <= closest) {
													closest = newDist;
													closestSide = checkNearby;
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
							}

							if (placeSide) {
								const dir = placeSide.getOpposite().toVector();
								const newDir = placeSide.toVector();
								const placeX = pos.x + dir.x;
								const placeZ = pos.z + dir.z;
								// for (let extendX = 0; extendX < scaffoldextend[1]; extendX++) {
								// 	console.info("ExtendX:", extendX);
								// }
								const placePosition = new BlockPos(placeX, keyPressedDump("shift") ? pos.y - (dir.y + 2) : pos.y + dir.y, placeZ);
								const hitVec = new Vector3$1(placePosition.x + (newDir.x != 0 ? Math.max(newDir.x, 0) : Math.random()), placePosition.y + (newDir.y != 0 ? Math.max(newDir.y, 0) : Math.random()), placePosition.z + (newDir.z != 0 ? Math.max(newDir.z, 0) : Math.random()));
								if (scaffoldtower[1] && keyPressedDump("space") && dir.y == -1 && player.motion.y < 0.2 && player.motion.y > 0.15) player.motion.y = 0.42;
								if (keyPressedDump("shift") && dir.y == 1 && player.motion.y > -0.2 && player.motion.y < -0.15) player.motion.y = -0.42;
								if (playerControllerDump.onPlayerRightClick(player, game.world, item, placePosition, placeSide, hitVec)) hud3D.swingArm();
								if (item.stackSize == 0) {
									player.inventory.main[player.inventory.currentItem] = null;
									return;
								}
							}
						}
					}
				}
				else {
					if (player && oldHeld != undefined) switchSlot(oldHeld);
					delete tickLoop["Scaffold"];
				}
			});
			scaffoldtower = scaffold.addoption("Tower", Boolean, true);
			// scaffoldextend = scaffold.addoption("Extend", Number, 0);

			let timervalue;
			const timer = new Module("Timer", function(callback) {
				reloadTickLoop(callback ? 50 / timervalue[1] : 50);
			});
			timervalue = timer.addoption("Value", Number, 1.2);
			new Module("Phase", function() {});

			const antiban = new Module("AntiBan", function() {});
			antiban.toggle();
			new Module("AutoRejoin", function() {});
			new Module("AutoQueue", function() {});
			new Module("AutoVote", function() {});
			const chatdisabler = new Module("ChatDisabler", function() {});
			chatdisablermsg = chatdisabler.addoption("Message", String, "youtube.com/c/7GrandDadVape");
			new Module("FilterBypass", function() {});
   
    
    const AutoDrop = new Module("AutoDrop", function (callback) {
    if (!callback) {
        delete tickLoop["AutoDrop"];
        hud3D.remove("AutoDropOverlay");
        return;
    }

    let dropVisuals = new Map();
    let dropTypeMap = new Map();
    const bestArmor = {};
    let lastRun = 0;

    const weaponClasses = new Set(["ItemSword", "ItemAxe", "ItemBow", "ItemPickaxe"]);
    const essentialsKeywords = ["gapple", "golden apple", "ender pearl", "fire charge"];

    const armorMaterialPriority = ["leather", "chain", "iron", "diamond"];
    const customArmorKeepList = ["god helmet", "legend boots"];

    function getArmorScore(stack) {
        const item = stack.getItem();
        const material = item.getArmorMaterial?.()?.toLowerCase?.() || "unknown";
        const materialIndex = armorMaterialPriority.indexOf(material);
        const materialScore = materialIndex === -1 ? -999 : materialIndex * 1000;

        const durabilityScore = stack.getMaxDamage() - stack.getItemDamage();
        return materialScore + durabilityScore;
    }

    tickLoop["AutoDrop"] = function () {
        const now = Date.now();
        if (now - lastRun < 100) return;
        lastRun = now;

        const keptTypes = new Set();
        const toDrop = [];

        if (!player.openContainer || player.openContainer !== player.inventoryContainer) return;
        const slots = player.inventoryContainer.inventorySlots;
        if (!slots || slots.length < 36) return;

        Object.keys(bestArmor).forEach(k => delete bestArmor[k]);

        [5, 6, 7, 8].forEach(i => {
            const slot = slots[i];
            if (!slot?.getHasStack()) return;
            const stack = slot.getStack();
            if (!(stack.getItem() instanceof ItemArmor)) return;
            const armorType = stack.getItem().armorType ?? "unknown";
            bestArmor["armor_" + armorType] = { stack, index: i };
        });

        for (let i = 0; i < 36; i++) {
            const slot = slots[i];
            if (!slot?.getHasStack()) continue;

            const stack = slot.getStack();
            const item = stack.getItem();
            const name = stack.getDisplayName().toLowerCase();

            if (essentialsKeywords.some(k => name.includes(k))) continue;
            if (customArmorKeepList.some(k => name.includes(k))) continue;

            if (item instanceof ItemBlock) {
                if (stack.stackSize < 5) {
                    toDrop.push(i);
                    dropTypeMap.set(i, "block");
                }
                continue;
            }

            if (item instanceof ItemArmor) {
                const armorType = item.armorType ?? "unknown";
                const key = "armor_" + armorType;
                const score = getArmorScore(stack);
                const existing = bestArmor[key];
                const existingScore = existing ? getArmorScore(existing.stack) : -1;

                if (!existing || score > existingScore) {
                    if (existing && existing.index !== i) {
                        toDrop.push(existing.index);
                        dropTypeMap.set(existing.index, "worse_armor");
                    }
                    bestArmor[key] = { stack, index: i };
                } else {
                    toDrop.push(i);
                    dropTypeMap.set(i, "armor_dupe");
                }
                continue;
            }

            const className = item.constructor.name;
            if (weaponClasses.has(className)) {
                if (!keptTypes.has(className)) {
                    keptTypes.add(className);
                } else {
                    toDrop.push(i);
                    dropTypeMap.set(i, "weapon_dupe");
                }
                continue;
            }

            toDrop.push(i);
            dropTypeMap.set(i, "junk");
        }

        toDrop.forEach(slot => {
            dropSlot(slot);
            dropVisuals.set(slot, now);
        });

        if (now % 1000 < 100) {
            dropVisuals.forEach((time, slot) => {
                if (now - time > 500) dropVisuals.delete(slot);
            });
        }
    };

    hud3D.add("AutoDropOverlay", function () {
        dropVisuals.forEach((_, slot) => {
            const x = (slot % 9) * 20 + 10;
            const y = Math.floor(slot / 9) * 20 + 60;
            const type = dropTypeMap.get(slot) || "junk";

            let color = "rgba(255,0,0,0.6)";
            if (type === "block") color = "rgba(128,128,128,0.6)";
            else if (type === "armor_dupe") color = "rgba(255,255,0,0.6)";
            else if (type === "worse_armor") color = "rgba(255,165,0,0.6)";
            else if (type === "weapon_dupe") color = "rgba(0,255,255,0.6)";

            drawImage("spritesheet.png", 32, 32, 16, 16, x, y, 16, 16, color);
        });
    });
});

function dropSlot(index) {
    playerControllerDump.windowClickDump(player.openContainer.windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(player.openContainer.windowId, -999, 0, 0, player);
}

                        // Place this with your other module definitions inside the main function

let funnyMessages = [
    // Classic Miniblox-style funny & savage messages
    "Sent back to the lobby—don't trip on the way out!",
    "Was that your best? Miniblox says no.",
    "You dropped faster than my WiFi.",
    "Did you forget to equip skill today?",
    "That was a tutorial death, right?",
    "Tip: Dodging is allowed.",
    "Respawn and try again (maybe with both hands).",
    "Out-clicked, out-played, outta here.",
    "Next time, bring a helmet. And armor. And hope.",
    "Imagine losing in Miniblox... tragic.",
    "Your blocks? My blocks now.",
    "Are you sure you're not an NPC?",
    "Pro tip: The void is not a shortcut.",
    "Is your keyboard upside down?",
    "That scoreboard doesn't lie.",
    "Miniblox called—wants its win streak back.",
    "Did you lag, or just freeze from fear?",
    "Was that a speedrun to the void?",
    "GG! (It was mostly me though.)",
    "You just got Minibloxed!",
    // Extra savage Miniblox lines
    "Don't blame the ping, blame the skill.",
    "You make AFK players look cracked.",
    "If you were any slower, you'd be a block.",
    "That was less of a fight, more of a donation.",
    "Did you forget which game you're playing?",
    "Keyboard check. Mouse check. Skill... missing.",
    "If losing was an achievement, you'd be top of the leaderboard.",
    "You respawn more than you blink.",
    "Hope you enjoy the respawn timer.",
    "Maybe try winning... just once?",
    "Did you just speedrun getting eliminated?",
    "Miniblox tip: Winning is allowed.",
    "You just made the highlight reel—of fails.",
    "The only thing lower than your HP was your chance to win.",
    "If you see this, you lost the 50/50. Badly.",
    "That performance was sponsored by gravity.",
    "Your only kill streak is in the practice lobby.",
    "You bring a whole new meaning to 'easy win.'",
    "That was faster than a Miniblox queue skip.",
    "You just gave me free stats.",
    // Legacy funny/mean lines
    "Did you drop your keyboard? Because your plays are a mess.",
    "I’ve seen bots with better aim.",
    "Are you playing with your monitor off?",
    "You just got outplayed by someone eating snacks IRL.",
    "Did your mouse disconnect?",
    "If you’re reading this, you just lost a 1v1.",
    "Not even lag could save you.",
    "Skill issue detected. Please reinstall.",
    "Your respawn button must be tired.",
    "You fight like a Miniblox villager.",
    "Maybe try using both hands next time.",
    "Spectator mode looks good on you.",
    "I hope you brought a map, because you’re lost.",
    "Knocked out like my WiFi on a stormy day.",
    "That combo was sponsored by gravity.",
    "I’d say GG, but that wasn’t even close.",
    "Do you need a tutorial?",
    "Blink if you need help.",
    "You just got styled on.",
    "Don’t worry, practice makes... well, you tried."
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
