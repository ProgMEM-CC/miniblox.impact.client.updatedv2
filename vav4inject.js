const storeName = "a" + crypto.randomUUID().replaceAll("-", "").substring(16);
const vapeName = crypto.randomUUID().replaceAll("-", "").substring(16);
const VERSION = "10-UNPATCHED1";

// Anticheat hooking (hide our store) + toString-safe proxy helper.
// See VapeRewrite packages/core/src/utils/helpers/proxy.ts and hooks/hide.ts:
// a plain `new Proxy(fn, ...)` makes `fn.toString()` return
// `function () { [native code] }` even for JS functions, which is detectable.
function createProxy(target, handler) {
	return new Proxy(target, {
		...handler,
		get(t, p, receiver) {
			const orig = (handler.get ?? Reflect.get)(t, p, receiver);
			return typeof orig === "function" && p !== "prototype" ? orig.bind(t) : orig;
		}
	});
}
function replaceAndCopyFunction(oldFunc, newFunc) {
	return createProxy(oldFunc, {
		apply(orig, origIden, origArgs) {
			const result = orig.apply(origIden, origArgs);
			newFunc(result);
			return result;
		}
	});
}
function __spliceIt(list, item) {
	const idx = list.indexOf(item);
	if (idx !== -1) list.splice(idx, 1);
	return list;
}

Object.getOwnPropertyNames = replaceAndCopyFunction(Object.getOwnPropertyNames, function (list) {
	__spliceIt(list, storeName);
	return list;
});
Object.keys = replaceAndCopyFunction(Object.keys, function (list) {
	__spliceIt(list, storeName);
	return list;
});
Object.values = replaceAndCopyFunction(Object.values, function (list) {
	try {
		const store = Object.getOwnPropertyDescriptor(globalThis, storeName)?.value;
		if (store !== undefined) __spliceIt(list, store);
	} catch { /* noop */ }
	return list;
});
Object.getOwnPropertyDescriptors = replaceAndCopyFunction(Object.getOwnPropertyDescriptors, function (list) {
	delete list[storeName];
	return list;
});

function initOrR(field, initializer) {
	return field ?? initializer();
}
function reverseMapping(mapping) {
	return Object.fromEntries(Object.entries(mapping).map(([obf, orig]) => [orig, obf]));
}
// Maps obfuscated fields back to readable names (built from MATCHED_DUMPS
// via Mappings). e.g. player.moveStrafe works even though the bundle field
// is minified. This is the reference project's remap proxy.
function remapObj(obj, mapping, rev) {
	rev ??= reverseMapping(mapping);
	return new Proxy(obj, {
		get(t, prop, receiver) {
			if (typeof prop !== "string") return Reflect.get(t, prop, receiver);
			const mapped = prop in rev;
			const real = mapped ? rev[prop] : prop;
			if (mapped && typeof LOG_REMAPPING !== "undefined" && LOG_REMAPPING) {
				console.debug("[Impact] remap get " + prop + " -> " + real);
			}
			const v = Reflect.get(t, real, receiver);
			return typeof v === "function" && prop !== "prototype" ? v.bind(t) : v;
		},
		set(t, prop, value, receiver) {
			if (typeof prop !== "string") return Reflect.set(t, prop, value, receiver);
			const mapped = prop in rev;
			if (mapped && typeof LOG_REMAPPING !== "undefined" && LOG_REMAPPING) {
				console.debug("[Impact] remap set " + prop + " -> " + rev[prop]);
			}
			return Reflect.set(t, mapped ? rev[prop] : prop, value, receiver);
		},
		has(t, prop) {
			if (typeof prop !== "string") return Reflect.has(t, prop);
			return Reflect.has(t, rev[prop] ?? prop);
		},
		deleteProperty(t, prop) {
			if (typeof prop !== "string") return Reflect.deleteProperty(t, prop);
			return Reflect.deleteProperty(t, rev[prop] ?? prop);
		},
		ownKeys(t) {
			return Reflect.ownKeys(t).map((k) => mapping[k] ?? k);
		},
		getOwnPropertyDescriptor(t, prop) {
			if (typeof prop === "string" && prop in rev) {
				return Reflect.getOwnPropertyDescriptor(t, rev[prop]);
			}
			return Reflect.getOwnPropertyDescriptor(t, prop);
		}
	});
}
// Same as remapObj, but also accepts the legacy `*Dump` suffix so old
// cheat code (player.moveStrafeDump, e.isInvisibleDump(), ...) keeps working:
// the suffix is stripped, then the readable name is remapped to obfuscated.
function aliasRemap(obj, mapping) {
	const rev = reverseMapping(mapping);
	function baseOf(prop) {
		return prop.endsWith("Dump") ? prop.slice(0, -4) : prop;
	}
	return new Proxy(obj, {
		get(t, prop, receiver) {
			if (typeof prop !== "string") return Reflect.get(t, prop, receiver);
			const v = Reflect.get(t, rev[baseOf(prop)] ?? baseOf(prop), receiver);
			return typeof v === "function" && prop !== "prototype" ? v.bind(t) : v;
		},
		set(t, prop, value, receiver) {
			if (typeof prop !== "string") return Reflect.set(t, prop, value, receiver);
			return Reflect.set(t, rev[baseOf(prop)] ?? baseOf(prop), value, receiver);
		},
		has(t, prop) {
			if (typeof prop !== "string") return Reflect.has(t, prop);
			return Reflect.has(t, rev[baseOf(prop)] ?? baseOf(prop));
		},
		deleteProperty(t, prop) {
			if (typeof prop !== "string") return Reflect.deleteProperty(t, prop);
			return Reflect.deleteProperty(t, rev[baseOf(prop)] ?? baseOf(prop));
		}
	});
}

/**
 * New backend: export scanning + runtime hooks (no code replacement).
 *
 * The old backend fetched the game's `assets/index-*.js`, did string
 * replacements on it (addModification) and re-injected the patched bundle.
 * Vector now changes the bundle constantly and broke those string matches
 * (see README), so we do what VapeRewrite's fix/unpatch PR did instead:
 *
 * 1. Fetch the bundle source ONLY to run dump regexes (find obfuscated
 *    field names). The source is never modified or re-injected.
 * 2. `import(scriptEl.src)` to get the bundle's real ES module exports,
 *    then scan them by shape to find ClientSocket/game/player/packets/etc.
 * 3. Use a remap proxy so cheat code can use readable names
 *    (player.moveStrafe) while the game uses minified ones.
 * 4. Hook behavior with proxies + an event bus (gameTick/playerTick/
 *    sendPacket/receivePacket/connect/render) instead of inline patches.
 */

// ── dumps (export scanning needs obfuscated field names; we only READ the bundle, never patch it) ──
// Patterns below are the reference project's (VapeRewrite fix/unpatch) dump
// regexes, verified against the live bundle: all match except `isConverting`
// (broken there too, but never used anywhere, so it is omitted).
const DUMP_REGEXES = {
	// PlayerMovement#applyInput
	moveForward: /this\.([a-zA-Z]+)=\([a-zA-Z]+\.(up|down)/m,
	moveStrafe: /this\.([a-zA-Z]+)=\+!!\w\.right\s*\+\s*\(\w\.left\s*\?\s*-1\s*:\s*0\)/m,
	// PathNavigateGround#isPositionClear
	iterator: /of\s*\w+\.([a-zA-Z]+)\(new/,
	// PlayerMovement#updatePlayerMoveState
	applyInput: /this\.(\w+)\(this\.currentInput\)/,
	// PlayerController#rightClickMouse
	sendUseItem: /\w\s*&&\s*this\.(\w+)\(\w,\s*.\.world,\s*\w,\s*\w,\s*\w\)/,
	updatePlayerMoveState: /this\.([a-zA-Z]*)\(\),\n*\s*this\.isUsingItem\(\)\s*&&/,
	getEyePos: /(\w+)\(\)\s*{\n*\s*let\s+\w\s*=\s*this\.pos\.clone\(\);\n*\s*return\s+\w.y\s*\+=\s*this\.getEyeHeight/,
	// BlockFenceGate#getStateForPlacement
	getHorizontalFacing: /return\s+this\.defaultState\.withState\(`facing`,\s*\w\.(\w+)\(\)\)/,
	// PlayerController#rightClickMouse
	onPlayerRightClick: /this\.(\w+)\(\s*\w+,\s*[^.]+\.world,\s*\w,\s*\w+,\s*\w\.side,\s*\w\.hitVec,?\s*,\s*\w\)/,
	// PlayerControllerMP#updateMouseOver
	isInvisible: /this\.capeMesh\s*&&\s*this\.entity\.([a-zA-Z]+)\(\)/m,
	// EntityItem#update
	pushOutOfBlocks: /this\.noPhysics\s*=\s*this\.(\w+)\(this/,
	// attackTargetEntityWithCurrentItem, in PlayerController#attackEntity
	attack: /\w+\.(\w+)\(e\),\n*\s*\w+\.hit\(\)/,
	lastReportedYaw: /this\.([a-zA-Z]*)=this\.yaw,this\.last/m,
	windowClick: /([a-zA-Z]*)\(this\.inventorySlots\.windowId/m,
	damageReduceAmount: /\w\.item\.(\w+)\s*\|\|\s*0/,
	// playerControllerMP
	syncItem: /([a-zA-Z]*)\(\),\n*\s*\w+\.sendPacket\(new\s*/m,
	// GLTF manager
	gltfManager: /await \w+\.(\w+)\.getModel/,
	addShaderToMaterialWorld: /static\s+(\w+)\(\w\)\s*\{\s*t\.userData\s*=\s*\{\s*time:\s*{\s*value:\s*2/,
	materialTransparentWorld: /this\.([a-zA-Z]*)\s*=\s*this\.materialTransparent\.clone\(/,
	potionAmplifiers: /\w+\.([a-zA-Z]+)\.set\(\w+\.([a-zA-Z]+)\.getId\(\),\s*`5`\)/,
	getFlag: /([a-zA-Z]+)\(([a-zA-Z]+)\)\s*{\s*\n*return\s*\(this\.dataWatcher\.getWatchableObjectByte\(0\)&1<<([a-zA-Z]+)\)!=0}/,
	setFlag: /setSprinting\(\w+\)\s*\{\n*\s*this\.([a-zA-Z]+)\([0-9]+,\s*([a-zA-Z]+)\)/,
	// EntityManager#shouldRenderEntity
	isInvisibleToPlayer: /!\w+\.world\.isBlockLoaded\(\w+\)\)\s*\|\|\s*!\w+\s*&&\s*\w+\.(\w+)\(\w+\)/m,
	// EntityZombie#update (ageable); isConverting omitted: broken upstream + unused
	getConversionTimeBoost: /this\.(\w+)\(\);\s*\(?this\.conversionTime\s*/m,
	convertToVillager: /this\.conversionTime\s*<=\s*0\s*&&\s*this\.(\w+)\(\)/,
	// EntityAgeable#setGrowingAge and EntityAgeable#onLivingUpdate
	setScaleForAge: /this\.(\w+)\(this\.isChild\(\)\)/,
	// SkinManager#loadMob
	createAtlasMat: /\.image\.width\s*\/\s*64\s*};\s*\w+\.(\w+)\(\w\),\s*\(?/m,
};
// When true, the remap proxy logs each obfuscated->readable translation.
// Keep false in production (20x easier to spot in logs otherwise).
const LOG_REMAPPING = false;
// Central place for obfuscated->readable mappings, built from MATCHED_DUMPS,
// so cheat code never thinks about dumps (reference mappings.ts).
// NOTE: world.entities is intentionally unmapped: it is a stable,
// non-minified field name in the bundle (no dump exists for it upstream).
const Mappings = {
	_playerController: undefined,
	_playerControllerMP: undefined,
	_world: undefined,
	_ClientEntityPlayer: undefined,
	_ItemArmor: undefined,
	_SkinManager: undefined,
	_entity: undefined,
	get playerController() {
		return initOrR(this._playerController, () => ofDumps("windowClick", "sendUseItem", "onPlayerRightClick"));
	},
	get playerControllerMP() {
		return initOrR(this._playerControllerMP, () => ofDumps("syncItem"));
	},
	get world() {
		return initOrR(this._world, () => ofDumps());
	},
	get ItemArmor() {
		return initOrR(this._ItemArmor, () => ofDumps("damageReduceAmount"));
	},
	get SkinManager() {
		return initOrR(this._SkinManager, () => ofDumps());
	},
	get ClientEntityPlayer() {
		return initOrR(this._ClientEntityPlayer, () => ofDumps(
			"moveForward", "moveStrafe", "lastReportedYaw", "attack",
			"getEyePos", "getHorizontalFacing", "getFlag", "setFlag",
			"updatePlayerMoveState", "applyInput"
		));
	},
	get entity() {
		return initOrR(this._entity, () => ofDumps("isInvisible"));
	},
};
const MATCHED_DUMPS = {};
let gameScript = "";
let scriptEl = null;
function isIndexScript(script) {
	try {
		if (!script || !script.src) return false;
		if (script.type !== "module") return false;
		return /\/assets\/index-.*\.js$/.test(new URL(script.src).pathname);
	} catch { return false; }
}
function findGameScript() {
	const scripts = Object.values(document.scripts || document.querySelectorAll("script"));
	const found = scripts.find(isIndexScript);
	if (found) return found;
	return document.querySelector('script[src*="assets/index-"]');
}
function matchDump(code, key, regex) {
	try {
		const matched = code.match(regex);
		return matched?.[1];
	} catch { return undefined; }
}
async function runDumps(code) {
	const entries = Object.entries(DUMP_REGEXES);
	const out = {};
	for (const [key, regex] of entries) {
		const v = await Promise.resolve(matchDump(code, key, regex));
		if (v !== undefined) out[key] = v;
		else console.warn("[Impact] Unmatched dump:", key, regex);
	}
	Object.assign(MATCHED_DUMPS, out);
	return out;
}
const gameScriptReady = (async function () {
	try {
		let sc = findGameScript();
		if (!sc) {
			sc = await new Promise((resolve) => {
				const obs = new MutationObserver(() => {
					const f = findGameScript();
					if (f) { obs.disconnect(); resolve(f); }
				});
				obs.observe(document.documentElement, { childList: true, subtree: true });
				setTimeout(() => { obs.disconnect(); resolve(findGameScript()); }, 15000);
			});
		}
		if (!sc) { console.error("[Impact] Failed to find game script"); return; }
		scriptEl = sc;
		const res = await fetch(scriptEl.src);
		gameScript = await res.text();
		await runDumps(gameScript);
	} catch (e) {
		console.error("[Impact] gameScript init failed:", e);
	}
})();
function ofDumps(...ks) {
	return Object.fromEntries(
		ks.map((k) => [MATCHED_DUMPS[k], k]).filter(([obf]) => obf !== undefined)
	);
}

// ── miniblox refs via export scanning ─────────────────────────────────
let __minibloxRaw = null;
let __rawValues = null;
function rawValues() {
	if (__rawValues) return __rawValues;
	if (!__minibloxRaw) return [];
	try { __rawValues = Object.values(__minibloxRaw); } catch { __rawValues = []; }
	return __rawValues;
}
function findExport(filter) {
	try { return rawValues().find(filter); } catch { return undefined; }
}
function filterExports(filter) {
	try { return rawValues().filter(filter); } catch { return []; }
}
function getInheritanceChain(obj) {
	const chain = new Set();
	let cur = obj;
	while (cur != null) {
		let proto = null;
		try { proto = Object.getPrototypeOf(cur); } catch { break; }
		if (proto == null || proto instanceof Function) break;
		chain.add(proto);
		cur = proto;
		if (cur == null) break;
	}
	return chain;
}
const MinibloxReady = gameScriptReady.then(async () => {
	if (!scriptEl?.src) return;
	__minibloxRaw = await import(scriptEl.src);
	__rawValues = null;
});
const Miniblox = {
	get raw() { return __minibloxRaw; },
	get packets() {
		return filterExports((x) => typeof x === "function" && "typeName" in x);
	},
	get ClientSocket() {
		return findExport((x) => typeof x === "function" &&
			"sendPacket" in x && "socket" in x && "connect" in x && "on" in x && "disconnect" in x);
	},
	get game() {
		let g = findExport((x) => x != null && typeof x === "object" &&
			"gameScene" in x && "player" in x && "world" in x);
		if (g) return g;
		try {
			const elem = document.querySelector("#react");
			const key = elem && Object.keys(elem)[0];
			const fiber = key && elem[key];
			const gg = fiber?.updateQueue?.baseState?.element?.props?.game;
			if (gg) return gg;
		} catch { /* noop */ }
		return undefined;
	},
	get Game() {
		const g = this.game;
		return g ? g.constructor : undefined;
	},
	get world() {
		const g = this.game;
		if (!g?.world) return undefined;
		return remapObj(g.world, Mappings.world);
	},
	get player() {
		const g = this.game;
		if (!g?.player) return undefined;
		return aliasRemap(g.player, Mappings.ClientEntityPlayer);
	},
	get chat() {
		return this.game?.chat;
	},
	get controller() { return this.playerController; },
	get playerController() {
		const g = this.game;
		if (!g?.controller) return undefined;
		return aliasRemap(g.controller, Mappings.playerController);
	},
	get playerControllerMP() {
		const found = findExport((x) => x != null && typeof x === "object" &&
			"lastSentSlot" in x && "isHittingBlock" in x);
		if (!found) return undefined;
		return aliasRemap(found, Mappings.playerControllerMP);
	},
	get controls() {
		return findExport((x) => x != null && typeof x === "object" && "pitchObject" in x);
	},
	get hud3D() {
		try {
			const camera = this.game?.gameScene?.camera;
			if (!camera?.children) return undefined;
			return camera.children.find((c) => c && "item" in c && "fireGroup" in c && "swingArm" in c);
		} catch { return undefined; }
	},
	get textureManager() {
		return findExport((c) => typeof c === "object" && c !== null && "fontLoader" in c);
	},
	get skinManager() {
		const tm = this.textureManager;
		if (!tm?.skinManager) return undefined;
		return remapObj(tm.skinManager, Mappings.SkinManager);
	},
	get Items() {
		try {
			if ((unsafeWindow).Items) return (unsafeWindow).Items;
		} catch { /* noop */ }
		return findExport((x) => x != null && typeof x === "object" &&
			"iron_sword" in x && "bow" in x && "stone" in x);
	},
	get Blocks() {
		try {
			if ((unsafeWindow).Blocks) return (unsafeWindow).Blocks;
		} catch { /* noop */ }
		return undefined;
	},
	get Materials() {
		return findExport((x) => typeof x === "function" && "air" in x && "water" in x && "lava" in x);
	},
	get Enchantments() {
		return findExport((x) => x != null && typeof x === "function" &&
			"protection" in x && "featherFalling" in x);
	},
	get Potions() {
		return findExport((x) => x != null && (typeof x === "object" || typeof x === "function") &&
			"blindness" in x && "jump" in x);
	},
	get Options() {
		return findExport((x) => x != null && (typeof x === "object" || typeof x === "function") &&
			"streamerMode" in x);
	},
	get ItemSword() {
		try { return this.Items?.iron_sword?.constructor; } catch { return undefined; }
	},
	get ItemArmor() {
		try { return this.Items?.iron_boots?.constructor; } catch { return undefined; }
	},
	get ItemBow() {
		try { return this.Items?.bow?.constructor; } catch { return undefined; }
	},
	get ItemBlock() {
		try { return this.Items?.stone?.constructor; } catch { return undefined; }
	},
	get ItemStack() {
		try {
			if ((unsafeWindow).ItemStack) return (unsafeWindow).ItemStack;
		} catch { /* noop */ }
		return undefined;
	},
	get BlockPos() {
		return findExport((x) => typeof x === "function" && "ORIGIN" in x);
	},
	get EnumFacing() {
		try {
			const p = this.player;
			if (!p?.getHorizontalDirection) return undefined;
			return p.getHorizontalDirection().constructor;
		} catch { return undefined; }
	},
	get EntityLivingBase() {
		try {
			const p = this.game?.player;
			if (!p) return undefined;
			for (const proto of getInheritanceChain(p)) {
				const ctor = proto?.constructor;
				if (ctor && Object.getOwnPropertyNames(ctor).includes("sprintingSpeedBoostModifier")) {
					return ctor;
				}
			}
		} catch { /* noop */ }
		return undefined;
	},
	get GameMode() {
		return findExport((x) => x != null && (typeof x === "object" || typeof x === "function") &&
			typeof x.fromId === "function");
	},
	get RANK() {
		return findExport((x) => x != null && typeof x === "object" && "LEVEL" in x);
	},
};
// three.js via the bundle's own three import (see VapeRewrite utils/refs/three.ts)
let __threeRaw = null;
const ThreeReady = gameScriptReady.then(async () => {
	try {
		const m = gameScript.match(/from\s*"(\.\/three-[^"]+\.js)"/);
		if (!m?.[1] || !scriptEl?.src) return;
		__threeRaw = await import(new URL(m[1], scriptEl.src).href);
	} catch (e) {
		console.warn("[Impact] three import failed:", e);
	}
});
const THREE = {
	get raw() { return __threeRaw; },
	get Vec3() {
		try {
			return Object.values(__threeRaw || {}).find((x) =>
				typeof x === "function" && x.prototype?.isVector3);
		} catch { return undefined; }
	},
	get Mesh() {
		try {
			return Object.values(__threeRaw || {}).find((x) =>
				typeof x === "function" && String(x).includes("this.type=`Mesh`"));
		} catch { return undefined; }
	},
	get BoxGeometry() {
		try {
			return Object.values(__threeRaw || {}).find((x) =>
				typeof x === "function" && String(x).includes("this.type=`BoxGeometry`"));
		} catch { return undefined; }
	},
};

// ── tiny event bus (replaces tickLoop/renderTickLoop patch anchors) ──
const Bus = {
	_handlers: {},
	on(ev, fn) {
		(this._handlers[ev] ??= []).push({ fn, once: false });
	},
	once(ev, fn) {
		(this._handlers[ev] ??= []).push({ fn, once: true });
	},
	emit(ev, data) {
		const list = this._handlers[ev];
		if (!list || list.length === 0) return data;
		for (let i = list.length - 1; i >= 0; i--) {
			try { list[i].fn(data); } catch (e) { console.error("[Impact] bus handler failed:", ev, e); }
			if (list[i].once) list.splice(i, 1);
		}
		return data;
	}
};
function Cancelable(data) {
	return {
		data,
		canceled: false,
		cancel() { this.canceled = true; }
	};
}
// packet refs: exported packets + ones discovered at runtime via sendPacket
const discoveredPackets = new Map();
function getPacket(name) {
	const fromExports = Miniblox.packets?.find((x) => x?.typeName === name);
	if (fromExports) return fromExports;
	return discoveredPackets.get(name);
}

// ── own key tracking (replaces the keyPressedDump wrapper dump) ──────
const pressedKeys = {};
window.addEventListener("keydown", (e) => { pressedKeys[e.code] = true; });
window.addEventListener("keyup", (e) => { pressedKeys[e.code] = false; });
window.addEventListener("blur", () => { for (const k of Object.keys(pressedKeys)) delete pressedKeys[k]; });
function isKeyDown(name) {
	try {
		if (Miniblox.game?.chat?.showInput) return false;
	} catch { /* noop */ }
	const lower = String(name).toLowerCase();
	const codes = [];
	if (lower === "space") codes.push("Space");
	else if (lower === "shift") codes.push("ShiftLeft", "ShiftRight");
	else if (lower.length === 1 && lower >= "a" && lower <= "z") codes.push("Key" + lower.toUpperCase());
	else if (lower.length === 1 && lower >= "0" && lower <= "9") codes.push("Digit" + lower);
	else codes.push(name, "Key" + name.toUpperCase?.());
	return codes.some((c) => pressedKeys[c]);
}
function keyPressedDump(name) { return isKeyDown(name); }
function degToRad(d) { return (d * Math.PI) / 180; }

// ── core hooks (proxy game methods; cheat logic subscribes via Bus) ──
let __origGameTick = null;
let __origPlayerTick = null;
let __origSendPacket = null;
let __origDecoderEmit = null;
let __origConnect = null;
function hookGameTick() {
	const game = Miniblox.game;
	if (!game?.fixedUpdate || game.fixedUpdate === __origGameTick) return;
	if (__origGameTick && game.fixedUpdate !== __origGameTick) __origGameTick = null;
	__origGameTick = game.fixedUpdate;
	game.fixedUpdate = createProxy(__origGameTick, {
		apply(target, thisArg, argArray) {
			try { Bus.emit("gameTick"); } catch { /* noop */ }
			return Reflect.apply(target, thisArg, argArray);
		}
	});
}
function hookPlayerTick() {
	const player = Miniblox.game?.player;
	if (!player?.fixedUpdate || player.fixedUpdate === __origPlayerTick) return;
	__origPlayerTick = player.fixedUpdate;
	player.fixedUpdate = createProxy(__origPlayerTick, {
		apply(target, thisArg, argArray) {
			const c = Cancelable();
			try { Bus.emit("playerTick", c); } catch { /* noop */ }
			if (c.canceled) return;
			return Reflect.apply(target, thisArg, argArray);
		}
	});
}
function hookRenderLoop() {
	let last = 0;
	function frame(t) {
		requestAnimationFrame(frame);
		if (t - last < 50) return;
		last = t;
		try { Bus.emit("render"); } catch { /* noop */ }
	}
	requestAnimationFrame(frame);
}
function hookSendPacket() {
	const cs = Miniblox.ClientSocket;
	if (!cs?.sendPacket || cs.sendPacket === __origSendPacket) return;
	__origSendPacket = cs.sendPacket;
	cs.sendPacket = createProxy(__origSendPacket, {
		apply(target, thisArg, argArray) {
			const pkt = argArray[0];
			try {
				const ctor = pkt?.constructor;
				if (ctor && typeof ctor.typeName === "string" && ctor.typeName) {
					if (!Miniblox.packets?.some((x) => x?.typeName === ctor.typeName)) {
						discoveredPackets.set(ctor.typeName, ctor);
					}
				}
			} catch { /* noop */ }
			const w = Cancelable(pkt);
			try { Bus.emit("sendPacket", w); } catch { /* noop */ }
			if (w.canceled) return;
			return Reflect.apply(target, thisArg, [w.data]);
		}
	});
}
function hookReceivePacket() {
	try {
		const cs = Miniblox.ClientSocket;
		const parser = cs?.socket?.io?.opts?.parser;
		const Decoder = parser?.Decoder;
		if (!Decoder?.prototype?.emit || Decoder.prototype.emit === __origDecoderEmit) return;
		__origDecoderEmit = Decoder.prototype.emit;
		Decoder.prototype.emit = createProxy(__origDecoderEmit, {
			apply(target, thisArg, argArray) {
				try {
					const ev = argArray[0];
					const body = argArray[1];
					if ((ev === "message" || ev === 2 || body?.type === 2) &&
						body?.data instanceof Array && typeof body.data[0] === "string") {
						const name = body.data[0];
						const w = Cancelable({ name, packet: body.data[1] });
						Bus.emit("receivePacket", w);
						if (w.canceled) return thisArg;
						body.data = [name, w.data.packet];
						return Reflect.apply(target, thisArg, [ev, body]);
					}
					if (body && typeof body === "object" && !Array.isArray(body)) {
						const keys = Object.keys(body);
						if (keys.length === 1 && typeof body[keys[0]] === "object") {
							const name = keys[0];
							const w = Cancelable({ name, packet: body[name] });
							Bus.emit("receivePacket", w);
							if (w.canceled) return thisArg;
							return Reflect.apply(target, thisArg, [ev, { [name]: w.data.packet }]);
						}
					}
				} catch (e) {
					console.warn("[Impact] receive hook failed:", e);
				}
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	} catch (e) {
		console.warn("[Impact] hookReceivePacket failed:", e);
	}
}
function hookConnect() {
	const cs = Miniblox.ClientSocket;
	if (!cs?.connect || cs.connect === __origConnect) return;
	__origConnect = cs.connect;
	cs.connect = createProxy(__origConnect, {
		apply(target, thisArg, argArray) {
			try {
				hookReceivePacket();
				Bus.emit("connect", argArray);
			} catch { /* noop */ }
			return Reflect.apply(target, thisArg, argArray);
		}
	});
}
function installCoreHooks() {
	hookGameTick();
	hookPlayerTick();
	hookRenderLoop();
	hookSendPacket();
	hookReceivePacket();
	hookConnect();
}
function waitForReact() {
	function ready() {
		try {
			const elem = document.querySelector("#react");
			if (!elem) return false;
			const key = Object.keys(elem)[0];
			if (!key) return false;
			return elem[key]?.updateQueue?.baseState?.element?.props?.game != null;
		} catch { return false; }
	}
	return new Promise((resolve) => {
		if (ready()) return resolve();
		const obs = new MutationObserver(() => {
			if (ready()) { obs.disconnect(); resolve(); }
		});
		obs.observe(document, { childList: true, subtree: true });
		setTimeout(() => { obs.disconnect(); resolve(); }, 30000);
	});
}
async function waitUntilReady() {
	await gameScriptReady;
	await MinibloxReady;
	await ThreeReady;
	await waitForReact();
}

(function () {
	'use strict';

	// ── compat globals: bundle-scope names the old patches relied on ──
	// Top-level symbol minification removed these from the game bundle's
	// scope (chunk splitting had already scattered them across chunks).
	// We resolve them via export scanning (Miniblox/THREE/getPacket) and
	// expose them here so the eval'd cheat code keeps working unchanged.
	let game, player, world, chat, controls, hud3D, ClientSocket;
	let playerControllerMP, playerControllerDump;
	let Items, Blocks, Materials, Enchantments, Potions, Options, RANK, GameMode;
	let ItemSword, ItemArmor, ItemBow, ItemBlock, ItemStack;
	let ItemTool, ItemPickaxe, ItemAxe, ItemSpade, ItemHoe, ItemFood, ItemAppleGold;
	let BlockAir, BlockDragonEgg, ContainerChest, EntityPlayer;
	let BlockPos, EnumFacing, Game, Equipment_Slot;
	let textureManager, skinManager;
	let Vector3$1, Mesh, boxGeometryDump;
	let SPacketUseEntity, SPacketClick, SPacketUseItem, SPacketPlayerAction;
	let SPacketPlayerPosLook, SPacketPlayerInput, SPacketMessage, SPacketTabComplete;
	let SPacketRequestChunk, SPacketBreakBlock, SPacketCraftItem, SPacketRespawn;
	let SPacketOpenShop, SPacketLoginStart;
	let toast;
	let MSPT = 50;

	class PBVector3 {
		constructor(o) { if (o) Object.assign(this, o); }
	}
	const PBAction = { RELEASE_USE_ITEM: 5 };
	function worldEntities() {
		try {
			const w = (typeof world !== "undefined" && world) || (Miniblox && Miniblox.world);
			if (!w) return [];
			const m = w.entities;
			if (m instanceof Map) return Array.from(m.values());
			if (m && typeof m.values === "function") {
				try { return Array.from(m.values()); } catch (e) { /* fallthrough */ }
			}
			// shape fallback: any Map on world holding entities
			const vals = Object.values(w);
			for (const v of vals) {
				if (v instanceof Map && v.size > 0) {
					const first = v.values().next().value;
					if (first && first.pos !== undefined && first.id !== undefined) {
						return Array.from(v.values());
					}
				}
			}
		} catch (e) { /* noop */ }
		return [];
	}
	function wrapEntity(e) {
		if (!e || typeof e !== "object") return e;
		try { return aliasRemap(e, Mappings.entity); } catch (x) { return e; }
	}
	function isPlayerEntity(e) {
		try {
			return !!e && typeof e.id !== "undefined" && !!e.pos &&
				typeof e.getHealth === "function" && !!e.mode;
		} catch (x) { return false; }
	}
	let __syncWarned = false;
	function syncHeldItem() {
		try {
			if (playerControllerMP) {
				const f = playerControllerMP.syncItem || playerControllerMP.syncItemDump;
				if (typeof f === "function") { f(); return; }
			}
		} catch (e) { /* fallthrough */ }
		if (!__syncWarned) {
			__syncWarned = true;
			console.warn("[Impact] syncItem ref missing; slot sync degraded");
		}
	}
	function armorValue(stack) {
		try {
			if (!stack) return 0;
			const itemBase = stack.getItem();
			let base = 1;
			const dampKey = MATCHED_DUMPS.damageReduceAmount;
			const damp = (dampKey && itemBase[dampKey]) ?? itemBase.damageReduceAmount ?? itemBase["damageReduceAmount"] ?? 0;
			if (typeof damp === "number") base += damp;
			let nbttaglist = null;
			try { nbttaglist = stack.getEnchantmentTagList(); } catch (x) { nbttaglist = null; }
			if (nbttaglist) {
				for (let i = 0; i < nbttaglist.length; ++i) {
					const id = nbttaglist[i].id;
					const lvl = nbttaglist[i].lvl;
					let protId = 0;
					try { protId = Enchantments && Enchantments.protection ? Enchantments.protection.effectId : 0; } catch (x) { protId = 0; }
					if (id == protId) base += Math.floor(((6 + lvl * lvl) / 3) * 0.75);
					else base += lvl * 0.01;
				}
			}
			return base * (stack.stackSize || 1);
		} catch (e) { return 0; }
	}




	async function initCheat() {
		await waitUntilReady();
		game = Miniblox.game;
		player = Miniblox.player;
		world = Miniblox.world;
		chat = Miniblox.chat;
		controls = Miniblox.controls;
		hud3D = Miniblox.hud3D;
		ClientSocket = Miniblox.ClientSocket;
		playerControllerMP = Miniblox.playerControllerMP;
		playerControllerDump = Miniblox.playerController;
		Items = Miniblox.Items; Blocks = Miniblox.Blocks; Materials = Miniblox.Materials;
		Enchantments = Miniblox.Enchantments; Potions = Miniblox.Potions; Options = Miniblox.Options;
		RANK = Miniblox.RANK; GameMode = Miniblox.GameMode; Game = Miniblox.Game;
		textureManager = Miniblox.textureManager; skinManager = Miniblox.skinManager;
		ItemSword = Miniblox.ItemSword; ItemArmor = Miniblox.ItemArmor;
		ItemBow = Miniblox.ItemBow; ItemBlock = Miniblox.ItemBlock; ItemStack = Miniblox.ItemStack;
		try {
			if (Items) {
				if (Items.iron_pickaxe) ItemPickaxe = Items.iron_pickaxe.constructor;
				if (Items.iron_axe) ItemAxe = Items.iron_axe.constructor;
				if (Items.iron_shovel) ItemSpade = Items.iron_shovel.constructor;
				if (Items.iron_hoe) ItemHoe = Items.iron_hoe.constructor;
				if (Items.apple) ItemFood = Items.apple.constructor;
				if (Items.golden_apple) ItemAppleGold = Items.golden_apple.constructor;
				try { ItemTool = (ItemPickaxe && Object.getPrototypeOf(ItemPickaxe)) || ItemPickaxe; } catch (e) { ItemTool = ItemPickaxe; }
			}
		} catch (e) { /* noop */ }
		try {
			if (Blocks) {
				if (Blocks.air) BlockAir = Blocks.air.constructor || Blocks.air;
				if (Blocks.dragon_egg) BlockDragonEgg = Blocks.dragon_egg.constructor || Blocks.dragon_egg;
			}
		} catch (e) { /* noop */ }
		try {
			ContainerChest = findExport(function (x) {
				return typeof x === "function" && x.prototype && ("numRows" in x.prototype);
			});
		} catch (e) { ContainerChest = undefined; }
		try { EntityPlayer = undefined; } catch (e) { /* noop */ }
		// instanceof-against-undefined throws, so backstop every class ref
		// that minification/chunk-splitting may have taken away. A dummy
		// class simply never matches (safe degradation, caught per-tick).
		function __dummyIfMissing(v) { return (typeof v === "function") ? v : (class {}); }
		ItemSword = __dummyIfMissing(ItemSword);
		ItemArmor = __dummyIfMissing(ItemArmor);
		ItemBow = __dummyIfMissing(ItemBow);
		ItemBlock = __dummyIfMissing(ItemBlock);
		ItemStack = __dummyIfMissing(ItemStack);
		ItemTool = __dummyIfMissing(ItemTool);
		ItemPickaxe = __dummyIfMissing(ItemPickaxe);
		ItemAxe = __dummyIfMissing(ItemAxe);
		ItemSpade = __dummyIfMissing(ItemSpade);
		ItemHoe = __dummyIfMissing(ItemHoe);
		ItemFood = __dummyIfMissing(ItemFood);
		ItemAppleGold = __dummyIfMissing(ItemAppleGold);
		BlockAir = __dummyIfMissing(BlockAir);
		BlockDragonEgg = __dummyIfMissing(BlockDragonEgg);
		ContainerChest = __dummyIfMissing(ContainerChest);
		BlockPos = Miniblox.BlockPos;
		EnumFacing = Miniblox.EnumFacing;
		try {
			Equipment_Slot = findExport(function (x) {
				return x && typeof x === "object" && ("MAIN_HAND" in x);
			});
		} catch (e) { Equipment_Slot = undefined; }
		Vector3$1 = (THREE && THREE.Vec3) || (player && player.pos && player.pos.constructor) || undefined;
		Mesh = (THREE && THREE.Mesh) || undefined;
		boxGeometryDump = (THREE && THREE.BoxGeometry) || undefined;
		SPacketUseEntity = getPacket("SPacketUseEntity");
		SPacketClick = getPacket("SPacketClick");
		SPacketUseItem = getPacket("SPacketUseItem");
		SPacketPlayerAction = getPacket("SPacketPlayerAction");
		SPacketPlayerPosLook = getPacket("SPacketPlayerPosLook");
		SPacketPlayerInput = getPacket("SPacketPlayerInput");
		SPacketMessage = getPacket("SPacketMessage");
		SPacketTabComplete = getPacket("SPacketTabComplete");
		SPacketRequestChunk = getPacket("SPacketRequestChunk");
		SPacketBreakBlock = getPacket("SPacketBreakBlock");
		SPacketCraftItem = getPacket("SPacketCraftItem");
		SPacketRespawn = getPacket("SPacketRespawn");
		SPacketOpenShop = getPacket("SPacketOpenShop");
		SPacketLoginStart = getPacket("SPacketLoginStart");
		toast = function (o) {
			try {
				const t = (o && o.title) || (o && o.description) || "toast";
				if (game && game.chat) game.chat.addChat({ text: String(t), color: "yellow" });
			} catch (e) { /* noop */ }
		};
		// vape logo texture (replaces glintTexture/loadVape/loadSpritesheet anchors)
		try {
			if (textureManager && textureManager.loader && !textureManager.vapeTexture) {
				textureManager.loader.loadAsync("https://raw.githubusercontent.com/ProgMEM-CC/miniblox.impact.client.updatedv2/refs/heads/main/favicon.png").then(function (t) {
					textureManager.vapeTexture = t;
				}).catch(function () { /* noop */ });
			}
		} catch (e) { /* noop */ }
		installCoreHooks();
		// NOTE: cheat bodies below were previously string-patched into the
		// game bundle. They now run here, in our own scope, against refs.
		// Cheat bodies (were string-patched into the bundle; now plain code).

		const SERVICES_SERVER = new URL("https://impactchat-server.vercel.app/");
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
					text: "Please set your nickname in the `Services` module in order to use IRC! (set it via the ClickGUI)",
					color: "red"
				});
				game.chat.addChat({
					text: "You can also set your nickname via .setoption: .setoption Services Name <your nickname, surround with double quotes if it contains any spaces>",
					color: "green"
				});
				return;
			}
			fetch(`${SERVICES_SEND_ENDPOINT}?author=${name}&platformID=impact:client`, {
				method: "POST",
				body: message
			}).then(async r => {
				if (!r.ok) {
					game.chat.addChat({
						text: `Failed sending IRC message (response not OK): ${r.status} ${r.statusText} ${await r.text()}`,
						color: "red"
					});
				}
			}).catch(r => {
				game.chat.addChat({
					text: `Failed sending IRC message (server down?): ${r} `,
					color: "red"
				});
			});
		}
		let showNametags, Services, murderMystery, tagsWhileSneaking, tagsInMM;
		let blocking = false;
		let sendYaw = false;
		let isMiddleClickDown = false;
		let sendY = false;
        let desync = false;
		let breakStart = Date.now();
		let noMove = Date.now();

		// a list of miniblox usernames to not attack + ignore (friends)
		/** @type string[] **/
		const clientFriends = [];
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
		let anim17Enabled;
		let useAccountGen, accountGenEndpoint;
		let attackTime = Date.now();
		let chatDelay = Date.now();
		
		const ANIM_17_SETTINGS = {
			rotationZ: Math.PI / 4,
			rotationX: 0,
			rotationY: Math.PI / 2,
			positionX: 0.2,
			positionY: 0.1,
			positionZ: 0,
			scale: 0.8,
			swingRotationZ: 1.6,
			swingRotationX: 0.8
		};
		
		function autoToggleShowNametagStuff() {
			if (!showNametags.enabled) {
				toast({
					title: "Turned on show nametags automatically!",
					status: "success"
				});
				showNametags.setEnabled(true);
			}
			if (tagsInMM[1] !== true) {
				tagsInMM[1] = true;
				toast({title: "Turned on Murder Mystery setting in show nametags module!" });
			}
		}

		function handleMurderMysteryHook(entity, currentItemStack) {
			const item = currentItemStack?.getItem();
			if (item === undefined)
				return;
			if (item instanceof ItemSword) {
				autoToggleShowNametagStuff();
				toast({
					title: `${entity.name} IS THE MURDERER!`,
					status: "warning"
				});
				
				// Dynamic Island notification
				if (enabledModules["DynamicIsland"]) {
					const dynamicIsland = globalThis[storeName].dynamicIsland;
					const cleanName = entity.name.replace(/\\[a-z]+\\/g, '');
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
					title: `${entity.name} has a bow.`,
					color: "blue"
				});
				
				// Dynamic Island notification
				if (enabledModules["DynamicIsland"]) {
					const dynamicIsland = globalThis[storeName].dynamicIsland;
					const cleanName = entity.name.replace(/\\[a-z]+\\/g, '');
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
			console.log(`${entity.name} is holding`, item);
		}
		async function generateAccount() {
			const dynamicIsland = globalThis[storeName].dynamicIsland;
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
					{ type: "text", content: `Generated account: ${j.name}`, x: 0, y: 0, size: 18 }
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
						try {
							if (typeof Game === "undefined" || !Game || Game.isActive()) {
								module.toggle();
								game.chat.addChat({
									text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
									color: module.enabled ? "lime" : "red"
								});
							}
						} catch (e) { /* noop */ }
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
					el.style.cssText = `
						position: absolute;
						left: ${centerX + element.x}px;
						top: ${centerY + element.y}px;
						color: ${element.color || "#fff"};
						font-size: ${element.size || 14}px;
						font-weight: ${element.bold ? "bold" : "normal"};
						white-space: nowrap;
						transform: translate(-50%, -50%);
						${element.shadow ? "text-shadow: 1px 1px 2px rgba(0,0,0,0.8);" : ""}
					`;
					el.textContent = element.content;
					return el;
				},
				
				createProgressElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const container = document.createElement("div");
					container.style.cssText = `
						position: absolute;
						left: ${centerX + element.x}px;
						top: ${centerY + element.y}px;
						width: ${element.width}px;
						height: ${element.height}px;
						background: ${element.bgColor || "#333"};
						border-radius: ${element.rounded ? (element.height / 2) + "px" : "0"};
						overflow: hidden;
						transform: translate(-50%, -50%);
					`;
					
					const bar = document.createElement("div");
					bar.style.cssText = `
						width: ${element.value * 100}%;
						height: 100%;
						background: ${element.color || "#0FB3A0"};
						transition: width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
					`;
					
					container.appendChild(bar);
					return container;
				},
				
				createToggleElement(element) {
					const centerX = this.currentWidth / 2;
					const centerY = this.currentHeight / 2;
					const size = element.size || 30;
					const container = document.createElement("div");
					container.style.cssText = `
						position: absolute;
						left: ${centerX + element.x}px;
						top: ${centerY + element.y}px;
						width: ${size * 1.8}px;
						height: ${size}px;
						background: ${element.state ? "#0FB3A0" : "#555"};
						border-radius: ${size / 2}px;
						transition: background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
						transform: translate(-50%, -50%);
					`;
					
					const circle = document.createElement("div");
					const circleSize = size * 0.8;
					circle.style.cssText = `
						width: ${circleSize}px;
						height: ${circleSize}px;
						background: #fff;
						border-radius: 50%;
						position: absolute;
						top: ${(size - circleSize) / 2}px;
						left: ${element.state ? (size * 1.8 - circleSize - (size - circleSize) / 2) : ((size - circleSize) / 2)}px;
						transition: left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
						box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					`;
					
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
					img.style.cssText = `
						position: absolute;
						left: ${centerX + element.x}px;
						top: ${centerY + element.y}px;
						width: ${element.width}px;
						height: ${element.height}px;
						transform: translate(-50%, -50%);
					`;
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
			if (typeof globalThis[storeName] === "undefined") globalThis[storeName] = {};
			const customScripts = {};
			globalThis[storeName].customScripts = customScripts;
			
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
					if (typeof globalThis[storeName].updateScriptsCategory === 'function') {
						globalThis[storeName].updateScriptsCategory();
					}
					
					return true;
				} catch (e) {
					console.error("Failed to execute script:", e);
					console.error("Script name:", name);
					console.error("Script code:", code);
					alert("Script error: " + e.message + "\n\nCheck console for details.");
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
				if (typeof globalThis[storeName].updateScriptsCategory === 'function') {
					globalThis[storeName].updateScriptsCategory();
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
						text: `[Impact] IRC server: ${message}`,
						color: systemMessageColor[1]
					});
					return;
				}
				const readable = PLATFORM_ID_TO_READABLE[platformID] ?? platformID;
				game.chat.addChat({
					text: `[Impact IRC] ${author} via ${readable}: ${message}`
				});
			}
			function startIRC() {
				// it's already connected, what is the point?
				if (ircSource !== undefined) return;
				if (!Services.enabled) return;
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
			}, "Broken", () => "Client");
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

			new Module("ClickTP", function(callback) {
				if(callback) {
					tickLoop["ClickTP"] = function() {
						if (isMiddleClickDown) {
							const pos = playerControllerDump.objectMouseOver.hitVec;
							// ClientSocket.sendPacket(new SPacketPlayerPosLook({
							// 	pos: {
							// 		x: pos.x + 1.2,
							// 		y: pos.y - 0.08,
							// 		z: pos.z
							// 	},
							// 	onGround: false
							// }));
							// ClientSocket.sendPacket(new SPacketPlayerPosLook({
							// 	pos: {
							// 		x: pos.x,
							// 		y: pos.y,
							// 		z: pos.z
							// 	},
							// 	onGround: true
							// }));
							player.setPosition(pos.x, pos.y, pos.z);
						}
					};
				} else delete tickLoop["ClickTP"];
			}, "Broken"); // it will tp you back to where your last saved pos was. 
			new Module("AntiBlind", function() {}, "Render");
			
			new Module("AntiCheat", function(callback) {
				if (!callback)
					return; // TODO: deinitialization logic
				// TODO: unimplemented after unpatch (was already a stub that
				// iterated every player and did nothing with them).
				for (const entity of worldEntities()) {
						if (!isPlayerEntity(entity))
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
			const velocity = new Module("Velocity", function() {}, "Combat", () => `${velocityhori[1]}% ${velocityvert[1]}%`);
			velocityhori = velocity.addoption("Horizontal", Number, 0);
			velocityvert = velocity.addoption("Vertical", Number, 0);
   
			// NoFall BETA
   			let noFallExtraYBeta;
			const NoFallBeta = new Module("NoFallBeta", function(callback) {
				if (callback) {
					tickLoop["NoFallBeta"] = function() {
						// check if the player is falling and above a block.
						// rayTraceBlocks is minified away; scan the column instead.
						sendY = false;
						try {
							if (!BlockPos || !world) return;
							const extra = noFallExtraYBeta[1];
							const bx = Math.floor(player.pos.x);
							const by = Math.floor(player.pos.y);
							const bz = Math.floor(player.pos.z);
							for (let y = by - 1; y >= by - Math.ceil(extra) - 2; y--) {
								let solid = false;
								try {
									const st = world.getBlockState(new BlockPos(bx, y, bz));
									const b = st && (st.getBlock ? st.getBlock() : st.block);
									solid = !!(b && b.material && b.material.isSolid && b.material.isSolid());
								} catch (e) { solid = false; }
								if (solid) {
									sendY = player.pos.y + extra;
									break;
								}
							}
						} catch (e) { /* noop */ }
					}
				} else {
					delete tickLoop["NoFallBeta"];
				}
			},"Broken",() => "Packet");
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
	 				// this will force desync off even if fly is on.
	  				// or something just to fix the 0 uses of fly while you're on the ground.
	 				else if (player.onGround && shouldDesync && desync) desync = false;
	  				shouldDesync = !player.onGround && player.motionY < -0.6 && player.fallDistance >= 2.5;
				};
			},"Broken",() => "Desync");

			// WTap
			new Module("WTap", function() {}, "Movement",() => "Packet");

			// AntiVoid
			new Module("AntiVoid", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["AntiVoid"] = function() {
						// rayTraceBlocks is minified away; scan down to y=0 instead.
						try {
							if (!BlockPos || !world) return;
							const bx = Math.floor(player.pos.x);
							const bz = Math.floor(player.pos.z);
							const by = Math.floor(player.pos.y);
							for (let y = by; y >= 0; y--) {
								let solid = false;
								try {
									const st = world.getBlockState(new BlockPos(bx, y, bz));
									const b = st && (st.getBlock ? st.getBlock() : st.block);
									solid = !!(b && b.material && b.material.isSolid && b.material.isSolid());
								} catch (e) { solid = false; }
								if (solid) return;
							}
							player.motion.y = 0;
						} catch (e) { /* noop */ }
					};
				}
				else delete tickLoop["AntiVoid"];
			}, "Movement",() => "Ignore");

			const criticals = new Module("Criticals", () => {}, "Combat", () => "Packet");
			criticals.toggleSilently();

			// this is a very old crash method,
			// bread (one of the devs behind atmosphere) found it
			// And later shared it with me when we were talking about the upcoming bloxd layer.

			let serverCrasherPacketsPerTick;
			// if I recall, each chunk is 16 blocks or something.
			// maybe we can get vector's servers to die by sending funny values or something idk.
			const SERVER_CRASHER_CHUNK_XZ_INCREMENT = 16;
			const serverCrasher = new Module("ServerCrasher", cb => {
				if (cb) {
					let x = 10;
					let z = 10;
					tickLoop["ServerCrasher"] = function() {
						if (!SPacketRequestChunk) return;
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
			}, "Broken", () => "Spam Chunk Load");

			serverCrasherPacketsPerTick = serverCrasher.addoption("PacketsPerTick", Number, 10);

			/** y offset values, that when used before attacking a player, gives a critical hit! **/
			const CRIT_OFFSETS = [
				0.08, -0.07840000152
			];

			/** call this before sending a use entity packet to attack. this makes the player crit **/
			function crit(when = criticals.enabled && player.onGround) {
				if (!when) {
					return;
				}
				if (!SPacketPlayerPosLook) return;

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

			// Killaura
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
							try { if (hud3D && hud3D.swingArm) hud3D.swingArm(); } catch (e) { /* noop */ }
							try { if (SPacketClick) ClientSocket.sendPacket(new SPacketClick({})); } catch (e) { /* noop */ }
							didSwing = true;
						}
						const box = entity.getEntityBoundingBox();
						const hitVec = player.getEyePos().clone().clamp(box.min, box.max);
						attacked++;
						syncHeldItem();

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
						if (SPacketUseEntity) {
							ClientSocket.sendPacket(new SPacketUseEntity({
								id: entity.id,
								action: 1,
								hitVec: new PBVector3({
									x: hitVec.x,
									y: hitVec.y,
									z: hitVec.z
								})
							}));
						} else {
							// packet not exported (chunk splitting): fall back to
							// direct controller call like the reference project
							try {
								const pc = playerControllerDump;
								const oldHitVec = pc && pc.objectMouseOver ? pc.objectMouseOver.hitVec : null;
								if (pc && pc.objectMouseOver) pc.objectMouseOver.hitVec = hitVec;
								if (pc && pc.attackEntity) pc.attackEntity(entity);
								if (pc && pc.objectMouseOver && oldHitVec) pc.objectMouseOver.hitVec = oldHitVec;
							} catch (e) { /* noop */ }
						}
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
						syncHeldItem();
						try {
							if (SPacketUseItem) {
								ClientSocket.sendPacket(new SPacketUseItem({}));
							} else if (playerControllerDump && playerControllerDump.sendUseItem) {
								playerControllerDump.sendUseItem(player, world, player.inventory.getCurrentItem());
							}
						} catch (e) { /* noop */ }
						blocking = true;
					}
				} else blocking = false;
			}

			function unblock() {
				if (blocking && swordCheck()) {
					syncHeldItem();
					try {
						if (SPacketPlayerAction && BlockPos && EnumFacing) {
							ClientSocket.sendPacket(new SPacketPlayerAction({
								position: BlockPos.ORIGIN.toProto(),
								facing: EnumFacing.DOWN.getIndex(),
								action: PBAction.RELEASE_USE_ITEM
							}));
						} else if (playerControllerDump && playerControllerDump.onStoppedUsingItem) {
							playerControllerDump.onStoppedUsingItem(player);
						}
					} catch (e) { /* noop */ }
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
				const localTeam = getTeam(player);
				// world.entities is stable (no dump needed); entities are
				// duck-typed because EntityPlayer is minified away.
				const entities2 = worldEntities();

				const sqRange = range * range;

				const targets = entities2.filter(e => {
					if (!isPlayerEntity(e) || e.id == player.id) return false;
					const distCheck = player.getDistanceSqToEntity(e) < sqRange;
					if (!distCheck) return false;
					const isFriend = clientFriends.includes(e.name);
					const friendCheck = !ignoreFriends && isFriend;
					if (friendCheck) return false;
					// pasted
					const {mode} = e;
					if (!mode || mode.isSpectator() || mode.isCreative()) return false;
					const invisCheck = killAuraAttackInvisible[1] || wrapEntity(e).isInvisibleDump();
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
					// ESP boxes need THREE refs (chunk-split); skip them if missing.
					if (Mesh && boxGeometryDump && game && game.gameScene && game.gameScene.ambientMeshes) {
						for(let i = 0; i < 10; i++) {
							try {
								const mesh = new Mesh(new boxGeometryDump(1, 2, 1));
								mesh.material.depthTest = false;
								mesh.material.transparent = true;
								mesh.material.opacity = 0.5;
								mesh.material.color.set(255, 0, 0);
								mesh.renderOrder = 6;
								game.gameScene.ambientMeshes.add(mesh);
								boxMeshes.push(mesh);
							} catch (e) { /* noop */ }
						}
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
								const cleanName = target.name.replace(/\\[a-z]+\\/g, '');
								
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
						if (typeof Vector3$1 === "undefined" || !Vector3$1) return;
						for(let i = 0; i < boxMeshes.length; i++) {
							const entity = attackList[i];
							const box = boxMeshes[i];
							box.visible = entity != undefined && killaurabox[1];
							if (box.visible) {
								try {
									const pos = entity.mesh.position;
									box.position.copy(new Vector3$1(pos.x, pos.y + 1, pos.z));
								} catch (e) { box.visible = false; }
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
			}, "Combat", () => `${killaurarange[1]} block${killaurarange[1] == 1 ? "" : "s"} ${killaurablock[1] ? "Auto Block" : ""}`);
			killaurarange = killaura.addoption("Range", Number, 6);
			killauraangle = killaura.addoption("Angle", Number, 360);
			killaurablock = killaura.addoption("AutoBlock", Boolean, true);
			killaurawall = killaura.addoption("Wallcheck", Boolean, false);
			killaurabox = killaura.addoption("Box", Boolean, true);
			killauraitem = killaura.addoption("LimitToSword", Boolean, false);
			killAuraAttackInvisible = killaura.addoption("AttackInvisbles", Boolean, true);
			killauraSwitchDelay = killaura.addoption("SwitchDelay", Number, 100);

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
							`Infinite Fly only works on servers using the old ac
(KitPvP, Skywars, Eggwars, Bridge Duels,
Classic PvP, and OITQ use the new ac, everything else is using the old ac)`});
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
			}, "Movement",  () => `V ${infiniteFlyVert[1]} ${infiniteFlyLessGlide[1] ? "LessGlide" : "MoreGlide"}`);
			infiniteFlyVert = infiniteFly.addoption("Vertical", Number, 0.12);
			infiniteFlyLessGlide = infiniteFly.addoption("LessGlide", Boolean, true);

			new Module("InvWalk", function() {},"Movement", () => "Ignore");
			new Module("KeepSprint", function() {},"Movement", () => "Ignore");
			new Module("NoSlowdown", function() {},"Combat", () => "Ignore");

// Speed (BROKEN due to anticheat) 
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
}, "Movement", () => `V ${speedvalue[1]} J ${speedjump[1]} ${speedauto[1] ? "A" : "M"}`);

// Options
speedbypass = speed.addoption("Bypass", Boolean, true);
speedvalue = speed.addoption("Speed", Number, 0.2);
speedjump = speed.addoption("JumpHeight", Number, 0.25);
speedauto = speed.addoption("AutoJump", Boolean, true);

			const step = new Module("Step", function() {}, "Player", () => `${stepheight[1]}`);
			stepheight = step.addoption("Height", Number, 0.18);


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
					dynamicIslandElement.style.cssText = `
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
					`;

					dynamicIslandContent = document.createElement("div");
					dynamicIslandContent.style.cssText = `
						position: relative;
						width: 100%;
						height: 100%;
						transition: opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
					`;

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
							? `${hours}h ${minutes}m`
							: minutes > 0
								? `${minutes}m ${seconds}s`
								: `${seconds}s`;

						// Pill-shaped horizontal layout with even spacing
						if (inGame) {
							const fps = Math.floor(game.resourceMonitor.filteredFPS);
							// do NOT use instantPing, it is never updated. use filteredPing instead.
							const ping = Math.floor(game.resourceMonitor.filteredPing);
							const imgWidth = 47;
							const fpsLbl = `${fps} FPS`;
							const pingLbl = `${ping} Ping`;
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
							const accountedWidth = baseWidth + estimatedTimeLen;
							const logoX = - (accountedWidth / 2) + 18;
							const timeX = (accountedWidth / 2) - (estimatedTimeLen / 1.2);
							dynamicIslandDefaultDisplay = {
								duration: 0,
								defaultDisplay: true,
								width: accountedWidth,
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
      
      new Module("1.7Animation", function() {}, "Render", () => "Block Swing");
			
			const textgui = new Module("TextGUI", function() {}, "Render");
			textguifont = textgui.addoption("Font", String, "Poppins");
			textguisize = textgui.addoption("TextSize", Number, 16);
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
				modal.style.cssText = `
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
				`;
				
				const container = document.createElement("div");
				container.style.cssText = `
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
				`;
				
				const title = document.createElement("h2");
				title.textContent = "Script Manager";
				title.style.cssText = `
					margin: 0 0 20px 0;
					color: #fff;
					font-size: 22px;
					font-weight: 600;
				`;
				
				const addButtonsContainer = document.createElement("div");
				addButtonsContainer.style.cssText = `
					display: flex;
					gap: 8px;
					margin-bottom: 16px;
				`;
				
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
									alert("Failed to load script: " + name + "\nCheck console for errors.");
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
									alert("Failed to load script: " + name + "\nCheck console for errors.");
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
				scriptList.style.cssText = `
					flex: 1;
					overflow-y: auto;
					margin-bottom: 16px;
					border: 2px solid #2a2a3e;
					border-radius: 6px;
					padding: 8px;
					background: #252538;
				`;
				
				function refreshScriptList() {
					scriptList.innerHTML = "";
					
					// Update Scripts category in ClickGUI
					if (typeof globalThis[storeName].updateScriptsCategory === 'function') {
						globalThis[storeName].updateScriptsCategory();
					}
					
					Object.entries(customScripts).forEach(([name, data]) => {
						const item = document.createElement("div");
						item.style.cssText = `
							background: #2a2a3e;
							border: 2px solid #3a3a4e;
							border-radius: 6px;
							padding: 12px;
							margin-bottom: 8px;
							display: flex;
							justify-content: space-between;
							align-items: center;
						`;
						
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
				modal.style.cssText = `
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
				`;
				
				const editor = document.createElement("div");
				editor.style.cssText = `
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
				`;
				
				const editorTitle = document.createElement("h3");
				editorTitle.textContent = editName ? "Edit Script" : "New Script";
				editorTitle.style.cssText = "margin: 0 0 16px 0; color: #fff; font-size: 18px;";
				
				const nameInput = document.createElement("input");
				nameInput.type = "text";
				nameInput.placeholder = "Script name";
				nameInput.value = editName || "";
				nameInput.style.cssText = `
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
				`;
				
				const codeArea = document.createElement("textarea");
				codeArea.placeholder = "// Write your script here\n// Example:\nnew Module('MyModule', function(enabled) {\n  if (enabled) {\n    tickLoop['MyModule'] = function() {\n      // Your code here\n      console.log(player.pos);\n    };\n  } else {\n    delete tickLoop['MyModule'];\n  }\n});";
				codeArea.value = editCode;
				codeArea.style.cssText = `
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
				`;
				
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
						alert("Failed to load script: " + name + "\nCheck console for errors.");
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
				btn.style.cssText = `
					padding: 10px 16px;
					background: #2a2a3e;
					border: 2px solid #3a3a4e;
					border-radius: 6px;
					color: #fff;
					cursor: pointer;
					font-size: 14px;
					font-weight: 600;
					outline: none;
				`;
				btn.onmouseover = () => btn.style.background = "#353548";
				btn.onmouseout = () => btn.style.background = "#2a2a3e";
				btn.onclick = onclick;
				return btn;
			}
			
			function createSmallButton(text, onclick) {
				const btn = document.createElement("button");
				btn.textContent = text;
				btn.style.cssText = `
					padding: 6px 10px;
					background: #2a2a3e;
					border: 2px solid #3a3a4e;
					border-radius: 4px;
					color: #fff;
					cursor: pointer;
					font-size: 14px;
					outline: none;
				`;
				btn.onmouseover = () => btn.style.background = "#353548";
				btn.onmouseout = () => btn.style.background = "#2a2a3e";
				btn.onclick = onclick;
				return btn;
			}
			
			// Load saved scripts on startup
			setTimeout(() => loadCustomScripts(), 1000);

			const blockHandlers = {
				rightClick(pos) {
					if (!SPacketClick) return;
					ClientSocket.sendPacket(new SPacketClick({
						location: pos
					}));
				},
				breakBlock(pos) {
					if (!SPacketBreakBlock) return;
					ClientSocket.sendPacket(new SPacketBreakBlock({
						location: pos,
						start: false
					}));
				}
			};

			function isAir(b) {
				try {
					return typeof BlockAir === "function" && b instanceof BlockAir;
				} catch (e) { return false; }
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
							if (typeof BlockDragonEgg === "function" && b instanceof BlockDragonEgg) {
								// Show notification on break
								if (enabledModules["DynamicIsland"]) {
									const dynamicIsland = globalThis[storeName].dynamicIsland;
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
			}, "Minigames", () => `${breakerrange[1]} block${breakerrange[1] == 1 ? "" : "s"}`);
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
			}, "World", () => `${nukerRange[1]} block${nukerRange[1] == 1 ? "" : "s"}`);
			nukerRange = nuker.addoption("Range", Number, 3);
			nukerDelay = nuker.addoption("Delay", Number, 1);

			function craftRecipe(recipe) {
				// crafting helpers are chunk-split exports; skip gracefully if missing
				if (typeof canCraftItem === "undefined" || typeof craftItem === "undefined") return;
				if (!SPacketCraftItem) return;
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
						try {
							if (typeof recipes === "undefined" || !Items) return;
							if (checkDelay < Date.now() && player.openContainer == player.inventoryContainer) {
								checkDelay = Date.now() + 300;
								if (!player.inventory.hasItem(Items.emerald_sword)) craftRecipe(recipes[1101][0]);
							}
						} catch (e) { /* noop */ }
					}
				}
				else delete tickLoop["AutoCraft"];
			}, "Minigames"); // this is for eggwars i think. Not that it matters now.

			
// ChestSteal
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

            // Check if we have a chest open (duck-typed: ContainerChest is minified away)
            if (player.openContainer &&
                typeof player.openContainer.numRows === "number" &&
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
            if (!player.openContainer || typeof player.openContainer.numRows !== "number") {
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


// Scaffold
let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle, scaffoldSameY;
let tickCount = 0;
let lastScaffoldY = null; // Tracks the Y coordinate for sameY mode

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
            text: "real bypasser!",
            color: "royalblue"
        });

        tickLoop["Scaffold"] = function() {
            tickCount++;

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

            // Calculate positions - MORE AGGRESSIVE PREDICTION!
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
				if(lastScaffoldY == playerY-1){
					targetY = playerY+2;
				} else {
                	targetY = playerY - 1;
				}
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
                    try { if (hud3D && hud3D.swingArm) hud3D.swingArm(); } catch (e) { /* noop */ }

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
        lastScaffoldY = null; // Resets the Y coordinate when scaffold is disabled.
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
			}, "World", () => `${timervalue[1]} MSPT`);
			timervalue = timer.addoption("Value", Number, 1);
			new Module("Phase", function() {}, "World");

			const antiban = new Module("AntiBan", function() {}, "Misc", () => useAccountGen[1] ? "Gen" : "Non Account");
			useAccountGen = antiban.addoption("AccountGen", Boolean, false);
			accountGenEndpoint = antiban.addoption("GenServer", String, "http://localhost:8000/generate");
			antiban.toggleSilently();
			new Module("AutoRejoin", function() {}, "Misc");
			new Module("AutoQueue", function() {}, "Minigames");
			new Module("AutoVote", function() {}, "Minigames");
			const chatdisabler = new Module("ChatDisabler", function() {}, "Misc", () => "Spam");
			chatdisablermsg = chatdisabler.addoption("Message", String, "Vector not gonna bypass this one 🗣️"); // V stands for Value Patch
			new Module("FilterBypass", function() {}, "Exploit", () => "\\");
   
    // InvManager
    let invmanagerLayout, invmanagerDelay, invmanagerDropJunk, invmanagerAutoArmor;
    
    const InvManager = new Module("InvManager", function (callback) {
		if (!callback) {
			delete tickLoop["InvManager"];
			return;
		}

		const essentials = ["gapple", "golden apple", "ender pearl", "fire charge", "ember stone"];
		const customKeep = ["god helmet", "legend boots"];
		let lastRun = 0;
		let managementPhase = -1; // -1: equip armor, 0: drop duplicates and junk, 1: clear hotbar, 2: pick item, 3: place item
		let lastInventoryState = "";
		let lastPhaseState = "";
		let fillIndex = 0;
		let pickedItemSlot = -1; // Track which slot we picked from
		let targetHotbarSlot = -1; // Track which hotbar slot we're filling
		let currentProcessingSlot = 0; // Track which hotbar slot we're currently processing

		function getMaterialScore(name) {
			name = name.toLowerCase();
			if (name.includes("diamond")) return 1000;
			if (name.includes("iron")) return 500;
			if (name.includes("stone")) return 100;
			if (name.includes("wood")) return 50;
			if (name.includes("gold")) return 300;
			return 0;
		}

		function getEnchantmentScore(stack) {
			const enchants = stack.getEnchantmentTagList();
			if (!enchants || enchants.length === 0) return 0;
			
			let score = 0;
			for (const enchant of enchants) {
				const level = enchant.lvl ?? 1;
				const id = enchant.id ?? 0;
				
				if (id === 16 || id === 20) score += level * 200;
				else if (id === 19 || id === 21) score += level * 150;
				else if (id === 0 || id === 1 || id === 3 || id === 4) score += level * 180;
				else if (id === 32 || id === 34) score += level * 100;
				else if (id === 48 || id === 49 || id === 50 || id === 51) score += level * 120;
				else score += level * 50;
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

		function getArmorStrength(stack) {
			// damageReduceAmount is minified; armorValue() reads it via dumps.
			return armorValue(stack);
		}

		function getBestArmorSlot(armorSlot, slots) {
			// Get current equipped armor strength
			const currentStack = slots[armorSlot].getHasStack() ? slots[armorSlot].getStack() : null;
			let bestStrength = currentStack ? getArmorStrength(currentStack) : 0;
			let bestSlot = -1; // -1 means no better armor found
			
			// Search inventory and hotbar (slots 0-39) for better armor
			for(let i = 0; i < 40; i++) {
				// Skip armor slots (0-3)
				if (i < 4) continue;
				
				const stack = slots[i].getHasStack() ? slots[i].getStack() : null;
				if (stack && stack.getItem() instanceof ItemArmor && (3 - stack.getItem().armorType) == armorSlot) {
					const strength = getArmorStrength(stack);
					if (strength > bestStrength) {
						bestSlot = i;
						bestStrength = strength;
					}
				}
			}
			return bestSlot;
		}

		function getItemCategory(item, stack) {
			// Check name-based categories first (for special items)
			const name = stack.getDisplayName().toLowerCase();
			if (name.includes("ender pearl") || name.includes("pearl")) return "pearl";
			if (name.includes("golden apple") || name.includes("gapple")) return "gapple";
			if (name.includes("tnt")) return "misc"; // TNT is not a placeable block for scaffold
			
			// Armor category
			if (item instanceof ItemArmor) return "armor";
			
			if (item instanceof ItemSword) return "sword";
			if (item instanceof ItemBow) return "bow";
			if (item instanceof ItemPickaxe) return "pickaxe";
			if (item instanceof ItemAxe) return "axe";
			if (item instanceof ItemSpade) return "shovel";
			if (item instanceof ItemBlock) return "blocks";
			if (item instanceof ItemFood) return "food";
			
			return "misc";
		}

		function shouldKeep(stack) {
			const name = stack.getDisplayName().toLowerCase();
			const item = stack.getItem();
			
			if (essentials.some(k => name.includes(k))) return true;
			if (customKeep.some(k => name.includes(k))) return true;
			if (item instanceof ItemBlock) return true;
			if (item instanceof ItemFood) return true;
			
			return false;
		}

		function parseLayout(layoutString) {
			const layout = {};
			const pairs = layoutString.split(",");
			for (const pair of pairs) {
				const [slot, category] = pair.split(":").map(s => s.trim());
				if (slot !== undefined && category) {
					// Convert 1-9 to 0-8 for internal use
					const slotNum = parseInt(slot);
					if (slotNum >= 1 && slotNum <= 9) {
						layout[slotNum - 1] = category;
					}
				}
			}
			return layout;
		}

		function getInventoryState(slots) {
			// Create a hash of inventory state to detect changes
			// Slots 0-39 (inventory + hotbar)
			let state = "";
			for (let i = 0; i < 40; i++) {
				const stack = slots[i]?.getStack();
				if (stack) {
					state += i + ":" + stack.getDisplayName() + ":" + stack.stackSize + ";";
				}
			}
			return state;
		}

		tickLoop["InvManager"] = function () {
			const now = Date.now();
			if (now - lastRun < invmanagerDelay[1]) return;
			lastRun = now;

			const slots = player?.inventoryContainer?.inventorySlots;
			if (!player.openContainer || player.openContainer !== player.inventoryContainer || !slots || slots.length < 36) return;

			const windowId = player.openContainer.windowId;
			const layout = parseLayout(invmanagerLayout[1]);

			// Debug: Log slot structure once
			if (!window.invManagerDebugLogged) {
				window.invManagerDebugLogged = true;
			}

			// Get current inventory state
			const currentState = getInventoryState(slots);

			// Check for external intervention (inventory changed during phase 1-3)
			if (managementPhase > 0 && currentState !== lastPhaseState) {
				// External change detected, restart from phase -1
				managementPhase = -1;
				fillIndex = 0;
				currentProcessingSlot = 0;
				lastInventoryState = currentState;
				lastPhaseState = currentState;
				return;
			}

			// Update state only in phase -1
			if (managementPhase === -1) {
				lastInventoryState = currentState;
				lastPhaseState = currentState;
			}

			// Phase -1: Auto equip best armor (if enabled)
			if (managementPhase === -1) {
				if (invmanagerAutoArmor[1]) {
					// Armor slots are 0-3 (helmet, chestplate, leggings, boots)
					for(let i = 0; i < 4; i++) {
						const bestSlot = getBestArmorSlot(i, slots);
						// bestSlot is -1 if no better armor found, or the slot index of better armor
						if (bestSlot !== -1) {
							// Found better armor in inventory, shift-click to equip it
							playerControllerDump.windowClickDump(windowId, bestSlot, 0, 1, player);
							lastPhaseState = getInventoryState(slots);
							return;
						}
					}
				}
				
				// Armor equipped or disabled, move to next phase
				managementPhase = 0;
				lastPhaseState = getInventoryState(slots);
				return;
			}

			// Phase 0: Drop duplicates and junk items
			if (managementPhase === 0) {
				const categoryItems = {};

				// Scan all inventory slots (including hotbar)
				// Slots 0-3: armor slots (skip these)
				// Slots 4-30: inventory
				// Slots 31-39: hotbar
				for (let i = 4; i < 40; i++) {
					const stack = slots[i]?.getStack();
					if (!stack) continue;

					const item = stack.getItem();
					const category = getItemCategory(item, stack);

					let score = 0;
					if (item instanceof ItemSword || item instanceof ItemBow) {
						score = getWeaponScore(stack, item);
					} else if (item instanceof ItemPickaxe || item instanceof ItemAxe || 
					           item instanceof ItemSpade || item instanceof ItemHoe || item instanceof ItemTool) {
						score = getToolScore(stack, item);
					} else if (shouldKeep(stack)) {
						score = 100;
					}

					if (!categoryItems[category]) {
						categoryItems[category] = [];
					}
					categoryItems[category].push({ stack, index: i, score });
				}

				// Drop duplicates and junk
				const layout = parseLayout(invmanagerLayout[1]);
				const layoutCategories = new Set(Object.values(layout));
				const keepMultiple = ["blocks", "food", "misc", "pearl", "gapple"];
				let foundItemToDrop = false;

				for (const [category, items] of Object.entries(categoryItems)) {
					// Sort by score (descending), then by index (ascending) for stable sort
					items.sort((a, b) => {
						if (b.score !== a.score) {
							return b.score - a.score;
						}
						return a.index - b.index; // Prefer lower index when scores are equal
					});
					
					let keepCount;
					const singleInstanceCategories = ["sword", "bow", "pickaxe", "axe", "shovel"];
					
					if (singleInstanceCategories.includes(category)) {
						// Weapons/tools: keep only 1
						keepCount = 1;
					} else if (layoutCategories.has(category)) {
						// In layout but not weapon/tool: keep 1 in hotbar + 1 in inventory
						keepCount = 2;
					} else if (keepMultiple.includes(category)) {
						// Useful items not in layout: keep all
						keepCount = items.length;
					} else {
						// Junk: drop all
						keepCount = 0;
					}
					
					// Drop items beyond keepCount
					for (let i = keepCount; i < items.length; i++) {
						dropSlot(items[i].index);
						foundItemToDrop = true;
						return; // Drop one per tick
					}
				}

				// No more items to drop, move to next phase
				if (!foundItemToDrop) {
					managementPhase = 1;
					fillIndex = 0;
					currentProcessingSlot = 0;
					lastPhaseState = getInventoryState(slots);
				}
				return;
			}

			// Phase 1: Clear incorrect items from hotbar (shift-click to inventory)
			if (managementPhase === 1) {
				const layout = parseLayout(invmanagerLayout[1]);
				
				// Hotbar is slots 31-39 (9 slots)
				for (let i = 0; i < 9; i++) {
					const slot = 31 + i; // Hotbar starts at slot 31
					const stack = slots[slot]?.getStack();
					if (!stack) {
						continue; // Empty slot, skip
					}

					const item = stack.getItem();
					const category = getItemCategory(item, stack);

					// Check if this item belongs in this slot
					const neededCategory = layout[i];
					if (neededCategory && category === neededCategory) {
						continue; // Correct item, keep it
					}

					// Wrong item or no item should be here, move to inventory
					playerControllerDump.windowClickDump(windowId, slot, 0, 1, player);
					lastPhaseState = getInventoryState(slots);
					return;
				}

				// All cleared, move to next phase
				managementPhase = 2;
				currentProcessingSlot = 0;
				lastPhaseState = getInventoryState(slots);
				return;
			}

			// Phase 2: Pick item from inventory (normal click)
			if (managementPhase === 2) {
				const layout = parseLayout(invmanagerLayout[1]);
				
				// Start from currentProcessingSlot and find next slot that needs filling
				// Hotbar is slots 31-39
				for (let i = currentProcessingSlot; i < 9; i++) {
					const slot = 31 + i; // Hotbar starts at slot 31
					const stack = slots[slot]?.getStack();
					const neededCategory = layout[i];
					
					// Skip if no category needed for this slot
					if (!neededCategory) {
						continue;
					}
					
					// Check if slot already has correct item
					if (stack) {
						const item = stack.getItem();
						const category = getItemCategory(item, stack);
						if (category === neededCategory) {
							continue;
						}
						
						// Slot has wrong item, need to clear it first
						playerControllerDump.windowClickDump(windowId, slot, 0, 1, player);
						lastPhaseState = getInventoryState(slots);
						return;
					}

					// Slot is empty, find best item in inventory for this category
					// Inventory is slots 0-30 (31 slots)
					let bestItem = null;
					let bestScore = -1;

					for (let invSlot = 0; invSlot < 31; invSlot++) {
						const invStack = slots[invSlot]?.getStack();
						if (!invStack) continue;

						const item = invStack.getItem();
						const category = getItemCategory(item, invStack);

						if (category === neededCategory) {
							let score = 0;
							if (item instanceof ItemSword || item instanceof ItemBow) {
								score = getWeaponScore(invStack, item);
							} else if (item instanceof ItemPickaxe || item instanceof ItemAxe || 
							           item instanceof ItemSpade || item instanceof ItemHoe || item instanceof ItemTool) {
								score = getToolScore(invStack, item);
							} else {
								score = 100;
							}

							if (score > bestScore) {
								bestScore = score;
								bestItem = invSlot;
							}
						}
					}

					// If found, pick it up
					if (bestItem !== null) {
						playerControllerDump.windowClickDump(windowId, bestItem, 0, 0, player);
						pickedItemSlot = bestItem;
						targetHotbarSlot = slot;
						currentProcessingSlot = i; // Remember which hotbar index we're filling
						managementPhase = 3;
						lastPhaseState = getInventoryState(slots);
						return;
					}
					
					// No item found for this slot, continue to next
				}

				// All slots processed, reset
				managementPhase = 0;
				pickedItemSlot = -1;
				targetHotbarSlot = -1;
				currentProcessingSlot = 0;
				lastPhaseState = getInventoryState(slots);
				return;
			}

			// Phase 3: Place picked item into hotbar slot (normal click)
			if (managementPhase === 3) {
				if (targetHotbarSlot >= 31 && targetHotbarSlot <= 39) {
					playerControllerDump.windowClickDump(windowId, targetHotbarSlot, 0, 0, player);
					
					// Move to next slot
					currentProcessingSlot = currentProcessingSlot + 1;
					managementPhase = 2; // Go back to phase 2 to continue filling
					pickedItemSlot = -1;
					targetHotbarSlot = -1;
					lastPhaseState = getInventoryState(slots);
					return;
				}
				
				// Something went wrong, reset
				managementPhase = 0;
				pickedItemSlot = -1;
				targetHotbarSlot = -1;
				currentProcessingSlot = 0;
				lastPhaseState = getInventoryState(slots);
			}
		};
}, "Player");

function dropSlot(index) {
    const windowId = player.openContainer.windowId;
    playerControllerDump.windowClickDump(windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(windowId, -999, 0, 0, player);
}

// InvManager options
invmanagerLayout = InvManager.addoption("Layout", String, "1:sword,2:pickaxe,3:bow,4:blocks,5:blocks,6:blocks,7:food,8:pearl,9:gapple");
invmanagerDelay = InvManager.addoption("Delay", Number, 150);
invmanagerDropJunk = InvManager.addoption("DropJunk", Boolean, true);
invmanagerAutoArmor = InvManager.addoption("AutoArmor", Boolean, true);
invmanagerDelay.range = [50, 500, 50];

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
                const dynamicIsland = globalThis[storeName].dynamicIsland;
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
                const dynamicIsland = globalThis[storeName].dynamicIsland;
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
                    const dynamicIsland = globalThis[storeName].dynamicIsland;
                    dynamicIsland.hide();
                }
            }
        }
    };
}, "Movement");

ljpower  = longjump.addoption("Power", Number, 0.6);
ljboost  = longjump.addoption("BoostTicks", Number, 10);
ljdesync = longjump.addoption("Desync", Boolean, true);

const survival = new Module("SurvivalMode", function(callback) {
				if (callback) {
					try {
						if (player && GameMode && GameMode.fromId) player.setGamemode(GameMode.fromId("survival"));
					} catch (e) { /* noop */ }
					
					// Dynamic Island notification
					if (enabledModules["DynamicIsland"]) {
						const dynamicIsland = globalThis[storeName].dynamicIsland;
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

			globalThis[storeName].modules = modules;
			globalThis[storeName].profile = "default";
			globalThis[storeName].dynamicIsland = dynamicIsland;

			window.dynamicIsland = dynamicIsland;
		})();
	

;
// PART3: unpatched wiring. Replaces every inline patch anchor with event
// subscriptions + proxies. Runs in the same eval scope as PART1/PART2,
// so closure vars (tickLoop, sendYaw, desync, modules, ...) are shared.
// --- tick/render wiring (replaces +=h*y+u*x} and applyEntityLighting anchors)
Bus.on("playerTick", function () {
	try {
		for (const k in tickLoop) {
			const f = tickLoop[k];
			if (f) f();
		}
	} catch (e) { console.error("[Impact] tickLoop failed:", e); }
});
Bus.on("render", function () {
	try {
		for (const k in renderTickLoop) {
			const f = renderTickLoop[k];
			if (f) f();
		}
	} catch (e) { console.error("[Impact] renderTickLoop failed:", e); }
});
// --- Sprint / KeepSprint / Step as ticks (their old inline patches are gone)
Bus.on("playerTick", function () {
	try {
		if (enabledModules["Sprint"] && player) {
			try { player.setSprinting(true); } catch (e) { /* noop */ }
		}
	} catch (e) { /* noop */ }
	try {
		if (enabledModules["KeepSprint"] && player) {
			try { player.setSprinting(true); } catch (e) { /* noop */ }
		}
	} catch (e) { /* noop */ }
	try {
		if (enabledModules["Step"] && player && stepheight) {
			const want = stepheight[1];
			if (typeof want === "number" && player.stepHeight !== undefined) {
				player.stepHeight = Math.max(want, player.stepHeight);
			}
		}
	} catch (e) { /* noop */ }
	try {
		if (enabledModules["WTap"] && player && typeof attacked !== "undefined" && attacked > 0) {
			player.serverSprintState = false;
		}
	} catch (e) { /* noop */ }
	try {
		if (enabledModules["AutoRespawn"] && game && player) {
			const dead = (game.showDeathScreen) || (player.getHealth && player.getHealth() <= 0);
			if (dead && SPacketRespawn) {
				ClientSocket.sendPacket(new SPacketRespawn());
			}
		}
	} catch (e) { /* noop */ }
});
// --- connect hook (replaces connect(u,h=!1,p=!1){ anchor)
Bus.on("connect", function (args) {
	try {
		if (args && args.length > 0) lastJoined = args[0];
		game = Miniblox.game; player = Miniblox.player; world = Miniblox.world;
		chat = Miniblox.chat; controls = Miniblox.controls; hud3D = Miniblox.hud3D;
		ClientSocket = Miniblox.ClientSocket;
		playerControllerMP = Miniblox.playerControllerMP;
		playerControllerDump = Miniblox.playerController;
		installCoreHooks();
	} catch (e) { console.warn("[Impact] connect refresh failed:", e); }
});
// --- middle click tracking (replaces mousedown/mouseup anchors)
document.addEventListener("mousedown", function (m) { if (m.which === 2) isMiddleClickDown = true; });
document.addEventListener("mouseup", function (m) { if (m.which === 2) isMiddleClickDown = false; });
// --- teleport fix + serverPos tracking (replaces setPositionAndRotation +
// --- reconcileServerPosition anchors)
let serverPos = null;
try { if (player && player.pos) serverPos = player.pos.clone(); } catch (e) { serverPos = null; }
try {
	if (player && player.setPositionAndRotation) {
		const __origSPAR = player.setPositionAndRotation;
		player.setPositionAndRotation = createProxy(__origSPAR, {
			apply: function (target, thisArg, argArray) {
				try {
					noMove = Date.now() + 500;
					serverPos = { x: argArray[0], y: argArray[1], z: argArray[2] };
				} catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
try {
	if (player && player.reconcileServerPosition) {
		const __origReconcile = player.reconcileServerPosition;
		player.reconcileServerPosition = createProxy(__origReconcile, {
			apply: function (target, thisArg, argArray) {
				try { serverPos = argArray[0]; } catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- ad bypass (replaces unleash anchor)
try {
	if (game && game.unleash && game.unleash.isEnabled) {
		const __origIsEnabled = game.unleash.isEnabled;
		game.unleash.isEnabled = createProxy(__origIsEnabled, {
			apply: function (target, thisArg, argArray) {
				if (argArray[0] === "disable-ads") return true;
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- NoSlowdown (replaces isUsingItem anchors)
try {
	if (player && player.isUsingItem) {
		const __origIsUsingItem = player.isUsingItem;
		player.isUsingItem = createProxy(__origIsUsingItem, {
			apply: function (target, thisArg, argArray) {
				try {
					const rawPlayer = game ? game.player : null;
					if (enabledModules["NoSlowdown"] && (thisArg === rawPlayer || thisArg === player)) return false;
				} catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- AntiBlind (replaces isPotionActive anchor)
try {
	if (player && player.isPotionActive) {
		const __origIsPotionActive = player.isPotionActive;
		player.isPotionActive = createProxy(__origIsPotionActive, {
			apply: function (target, thisArg, argArray) {
				try {
					if (enabledModules["AntiBlind"]) {
						if (Potions && Potions.blindness && argArray[0] === Potions.blindness) return false;
					}
				} catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- InvWalk (replaces Game.isActive anchor)
try {
	const GCls = (typeof Game !== "undefined" && Game) || (game && game.constructor);
	if (GCls && GCls.isActive) {
		const __origIsActive = GCls.isActive;
		GCls.isActive = createProxy(__origIsActive, {
			apply: function (target, thisArg, argArray) {
				try {
					if (enabledModules["InvWalk"] && game && game.chat && !game.chat.showInput) return true;
				} catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- Killaura blocking state (replaces this.entity.isBlocking() anchor)
try {
	const ELB = Miniblox.EntityLivingBase;
	const rawPlayer = game ? game.player : null;
	const blockingProto = ELB && ELB.prototype && ELB.prototype.isBlocking;
	if (blockingProto) {
		ELB.prototype.isBlocking = createProxy(blockingProto, {
			apply: function (target, thisArg, argArray) {
				try {
					if (blocking && (thisArg === rawPlayer || (thisArg && rawPlayer && thisArg.id === rawPlayer.id))) return true;
				} catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	} else if (player && player.isBlocking) {
		const __origIsBlocking = player.isBlocking;
		player.isBlocking = createProxy(__origIsBlocking, {
			apply: function (target, thisArg, argArray) {
				try { if (blocking) return true; } catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- Phase pushOutOfBlocks (replaces pushOutOfBlocks anchor; X/Y/Z collision
// --- scaling has no proxy equivalent and stays a TODO like upstream)
try {
	const ELB2 = Miniblox.EntityLivingBase;
	const poob = ELB2 && ELB2.prototype && ELB2.prototype.pushOutOfBlocks;
	if (poob) {
		ELB2.prototype.pushOutOfBlocks = createProxy(poob, {
			apply: function (target, thisArg, argArray) {
				try { if (enabledModules["Phase"]) return; } catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	} else if (player && player.pushOutOfBlocks) {
		const __origPOOB = player.pushOutOfBlocks;
		player.pushOutOfBlocks = createProxy(__origPOOB, {
			apply: function (target, thisArg, argArray) {
				try { if (enabledModules["Phase"]) return; } catch (e) { /* noop */ }
				return Reflect.apply(target, thisArg, argArray);
			}
		});
	}
} catch (e) { /* noop */ }
// --- C2S send hook: commands + FilterBypass + login + desync + sendYaw + sendY
function __typeName(pkt) {
	try {
		const c = pkt && pkt.constructor;
		if (c && typeof c.typeName === "string" && c.typeName) return c.typeName;
	} catch (e) { /* noop */ }
	return "";
}
function __handleCommandPacket(w, pkt) {
	const rawText = pkt.text;
	if (typeof rawText !== "string") return false;
	const text = rawText;
	if (!(text.startsWith(".") || text.startsWith(";")) || text.startsWith("..")) {
		// FilterBypass for normal chat (replaces submit(u){ anchor tail)
		try {
			if (enabledModules["FilterBypass"]) {
				const words = text.split(" ");
				const out = [];
				for (const word of words) out.push(word.charAt(0) + "\\" + word.slice(1));
				pkt.text = out.join(" ");
			}
		} catch (e) { /* noop */ }
		return false;
	}
	w.cancel();
	const verb = text.split(" ")[0].toLocaleLowerCase();
	const args = text.split(" ");
	args[0] = verb;
	let chatString;
	const gstore = globalThis[storeName];
	switch (args[0]) {
		case ".bind": {
			const module = args.length > 2 && getModule(args[1]);
			if (module) module.setbind(args[2] == "none" ? "" : args[2], true);
			break;
		}
		case ".panic":
			for (const entry of Object.entries(modules)) entry[1].setEnabled(false);
			game.chat.addChat({ text: "Toggled off all modules!", color: "red" });
			break;
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
					for (const entry of Object.entries(modules)) entry[1].toggleSilently();
				}
			}
			break;
		case ".modules":
			chatString = "Module List\n";
			{
				const byCat = {};
				for (const entry of Object.entries(modules)) {
					const nm = entry[0]; const md = entry[1];
					if (!byCat[md.category]) byCat[md.category] = [];
					byCat[md.category].push(nm);
				}
				for (const entry of Object.entries(byCat)) {
					chatString += "\n\n" + entry[0] + ":";
					for (const n of entry[1]) chatString += "\n" + n;
				}
			}
			game.chat.addChat({ text: chatString });
			break;
		case ".binds":
			chatString = "Bind List\n";
			for (const entry of Object.entries(modules)) chatString += "\n" + entry[0] + " : " + (entry[1].bind != "" ? entry[1].bind : "none");
			game.chat.addChat({ text: chatString });
			break;
		case ".setoption":
		case ".reset": {
			const module = args.length > 1 && getModule(args[1]);
			const reset = args[0] == ".reset";
			if (module) {
				if (args.length < 3) {
					chatString = module.name + " Options";
					for (const entry of Object.entries(module.options)) chatString += "\n" + entry[0] + " : " + entry[1][0].name + " : " + entry[1][1];
					game.chat.addChat({ text: chatString });
					break;
				}
				let option = null;
				for (const entry of Object.entries(module.options)) {
					if (entry[0].toLocaleLowerCase() == args[2].toLocaleLowerCase()) option = entry[1];
				}
				if (!option) break;
				if (reset) {
					option[1] = option[option.length - 1];
					game.chat.addChat({ text: "Reset " + module.name + " " + option[2] + " to " + option[1] });
					break;
				}
				const rawVal = text.split(" ").slice(3).join(" ");
				if (option[0] == Number) option[1] = !isNaN(Number.parseFloat(rawVal)) ? Number.parseFloat(rawVal) : option[1];
				else if (option[0] == Boolean) option[1] = rawVal == "true";
				else if (option[0] == String) option[1] = rawVal;
				game.chat.addChat({ text: "Set " + module.name + " " + option[2] + " to " + option[1] });
			}
			break;
		}
		case ".chat":
		case ";":
			if (!Services.enabled) {
				game.chat.addChat({ text: "Please enable Services before trying to use IRC!" });
				break;
			}
			{
				const msg = text.split(" ").slice(1).join(" ");
				sendIRCMessage(msg);
			}
			break;
		case ".config":
		case ".profile":
			if (args.length > 1) {
				if (args[1] == "save") {
					gstore.saveVapeConfig(args[2]);
					game.chat.addChat({ text: "Saved config " + args[2] });
				} else if (args[1] == "load") {
					gstore.saveVapeConfig();
					gstore.loadVapeConfig(args[2]);
					game.chat.addChat({ text: "Loaded config " + args[2] });
				} else if (args[1] == "import") {
					gstore.importVapeConfig(args[2]);
					game.chat.addChat({ text: "Imported config" });
				} else if (args[1] == "export") {
					gstore.exportVapeConfig();
					game.chat.addChat({ text: "Config set to clipboard!" });
				}
			}
			break;
		case ".shop": {
			if (SPacketOpenShop) ClientSocket.sendPacket(new SPacketOpenShop({}));
			break;
		}
		case ".friend": {
			const mode = args[1];
			if (!mode) {
				game.chat.addChat({ text: "Usage: .friend <add|remove> <username> OR .friend list" });
				break;
			}
			const nm = text.split(" ")[2];
			if (mode !== "list" && !nm) {
				game.chat.addChat({ text: "Usage: .friend <add|remove> <username> OR .friend list" });
				break;
			}
			if (args[1] === "add") {
				clientFriends.push(nm);
				game.chat.addChat({ text: "added " + nm + " as a friend" });
			} else if (args[1] === "remove") {
				const idx = clientFriends.indexOf(nm);
				if (idx !== -1) clientFriends.splice(idx, 1);
			} else if (args[1] === "list") {
				if (clientFriends.length === 0) {
					game.chat.addChat({ text: "You have no friends added yet!", color: "red" });
				} else {
					game.chat.addChat({ text: "Friends:", color: "yellow" });
					for (const fr of clientFriends) game.chat.addChat({ text: fr, color: "blue" });
				}
			}
			break;
		}
		case ".report": {
			const title = window.prompt("Issue title:", "");
			if (!title) break;
			const body = window.prompt("Issue description:", "") || "No description provided.";
			const url = "https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/issues/new?labels=bug&title="
				+ encodeURIComponent("[Bug] " + title) + "&body="
				+ encodeURIComponent(body + "\n\n---\n**Version:** " + VERSION + "\n**User Agent:** " + navigator.userAgent);
			window.open(url, "_blank");
			break;
		}
		case ".scriptmanager": {
			if (modules["ScriptManager"] && !modules["ScriptManager"].enabled) {
				modules["ScriptManager"].toggleSilently();
			}
			break;
		}
	}
	return true;
}
Bus.on("sendPacket", function (w) {
	const pkt = w.data;
	if (!pkt || typeof pkt !== "object") return;
	const typeName = __typeName(pkt);
	// chat/commands (replaces submit(u){ anchor)
	if (typeName === "SPacketMessage" || (typeName === "" && typeof pkt.text === "string")) {
		try { __handleCommandPacket(w, pkt); } catch (e) { console.error(e); }
		if (w.canceled) return;
	}
	// login bypass (replaces SPacketLoginStart anchor)
	if (typeName === "SPacketLoginStart" || (typeName === "" && "requestedUuid" in pkt && "hydration" in pkt)) {
		try {
			pkt.requestedUuid = undefined;
			pkt.hydration = "0";
			try { pkt.metricsId = crypto.randomUUID(); } catch (e) { /* noop */ }
			if (enabledModules["AntiBan"]) {
				if (useAccountGen && useAccountGen[1]) {
					w.cancel();
					generateAccount().then(function (j) {
						try {
							pkt.session = j.session;
							ClientSocket.sendPacket(pkt);
						} catch (e) { console.error(e); }
					}).catch(function (e) {
						console.error("[Impact] account gen failed:", e);
						try { ClientSocket.sendPacket(pkt); } catch (x) { /* noop */ }
					});
					return;
				}
				pkt.session = "";
			}
		} catch (e) { console.error(e); }
		return;
	}
	// desync (replaces inputSequenceNumber++ anchor): hold movement packets
	try {
		if (desync && (typeName === "SPacketPlayerInput" || (typeName === "" && "sequenceNumber" in pkt && "pos" in pkt))) {
			w.cancel();
			return;
		}
	} catch (e) { /* noop */ }
	// silent yaw (replaces yaw:this.yaw + lastReportedYaw anchors)
	try {
		if (sendYaw !== false && sendYaw !== undefined && typeof pkt.yaw === "number") {
			pkt.yaw = sendYaw;
		}
	} catch (e) { /* noop */ }
	// NoFallBeta height (replaces y:min.y anchor)
	try {
		if (sendY !== false && sendY !== undefined && pkt.pos && typeof pkt.pos.y === "number") {
			pkt.pos.y = sendY;
		}
	} catch (e) { /* noop */ }
});
// --- S2C receive hook: Velocity/AutoRejoin/chat/staff (replaces ClientSocket.on anchors)
Bus.on("receivePacket", function (w) {
	let name = "";
	let h = null;
	try {
		name = w.data.name;
		h = w.data.packet;
	} catch (e) { return; }
	if (!h || typeof h !== "object") return;
	try {
		if (name === "CPacketDisconnect") {
			if (enabledModules["AutoRejoin"]) {
				try {
					if (enabledModules["DynamicIsland"]) {
						globalThis[storeName].dynamicIsland.show({
							duration: 2000, width: 260, height: 60,
							elements: [
								{ type: "text", content: "AutoRejoin", x: 0, y: -8, color: "#fff", size: 13, bold: true },
								{ type: "text", content: "Rejoining in 0.4s", x: 0, y: 12, color: "#888", size: 11 }
							]
						});
					}
				} catch (e) { /* noop */ }
				setTimeout(function () { try { game.connect(lastJoined); } catch (e) { /* noop */ } }, 400);
			}
			return;
		}
		if (name === "CPacketEntityVelocity") {
			if (player && h.id == player.id && enabledModules["Velocity"]) {
				const vH = velocityhori ? velocityhori[1] : 0;
				const vV = velocityvert ? velocityvert[1] : 0;
				if (vH === 0 && vV === 0) { w.cancel(); return; }
				const pH = vH / 100;
				const pV = vV / 100;
				try {
					if (THREE.Vec3 && h.motion) {
						h.motion = new THREE.Vec3(h.motion.x * pH, h.motion.y * pV, h.motion.z * pH);
					} else if (h.motion) {
						h.motion.x *= pH; h.motion.y *= pV; h.motion.z *= pH;
					}
				} catch (e) { /* noop */ }
			}
			return;
		}
		if (name === "CPacketExplosion") {
			if (h.playerPos && enabledModules["Velocity"]) {
				const vH = velocityhori ? velocityhori[1] : 0;
				const vV = velocityvert ? velocityvert[1] : 0;
				if (vH === 0 && vV === 0) { h.playerPos = undefined; return; }
				const pH = vH / 100;
				const pV = vV / 100;
				try {
					if (THREE.Vec3) {
						h.playerPos = new THREE.Vec3(h.playerPos.x * pH, h.playerPos.y * pV, h.playerPos.z * pH);
					} else {
						h.playerPos.x *= pH; h.playerPos.y *= pV; h.playerPos.z *= pH;
					}
				} catch (e) { /* noop */ }
			}
			return;
		}
		if (name === "CPacketMessage") {
			if (player && h.text && !h.text.startsWith(player.name) && enabledModules["ChatDisabler"] && chatDelay < Date.now()) {
				chatDelay = Date.now() + 1000;
				setTimeout(function () {
					try {
						if (SPacketMessage) ClientSocket.sendPacket(new SPacketMessage({ text: Math.random() + ("\n" + chatdisablermsg[1]).repeat(20) }));
					} catch (e) { /* noop */ }
				}, 50);
			}
			if (h.text && h.text.startsWith("\\bold\\How to play:")) {
				breakStart = Date.now() + 25000;
			}
			if (h.text && h.text.indexOf("Poll started") != -1 && h.id == undefined && enabledModules["AutoVote"]) {
				try {
					globalThis[storeName].dynamicIsland.show({
						duration: 3e3, width: 330, height: 67,
						elements: [{ type: "text", content: "Voting for #2 (Overpowered)", x: 0, y: 0, size: 18 }]
					});
				} catch (e) { /* noop */ }
				try { if (SPacketMessage) ClientSocket.sendPacket(new SPacketMessage({ text: "/vote 2" })); } catch (e) { /* noop */ }
			}
			if (h.text && h.text.endsWith && h.text.endsWith("Press N to queue for the next game!") && h.id == undefined && enabledModules["AutoQueue"]) {
				try {
					globalThis[storeName].dynamicIsland.show({
						duration: 1.55e3, width: 370, height: 67,
						elements: [{ type: "text", content: "Queueing next game in 1.5 seconds", x: 0, y: 0, size: 18 }]
					});
				} catch (e) { /* noop */ }
				setTimeout(function () {
					try { if (enabledModules["AutoQueue"]) game.requestQueue(); } catch (e) { /* noop */ }
				}, 1.5e3);
			}
			return;
		}
		if (name === "CPacketUpdateStatus") {
			try {
				if (h.rank && h.rank != "" && RANK && RANK.LEVEL && RANK.LEVEL[h.rank] && RANK.LEVEL[h.rank].permLevel > 2) {
					game.chat.addChat({ text: "STAFF DETECTED : " + h.rank + "\n".repeat(10), color: "red" });
				}
			} catch (e) { /* noop */ }
			return;
		}
	} catch (e) { console.error("[Impact] receive handler failed:", e); }
});
// --- ESP + nametags + team (replaces shouldRenderEntity/updateNameTag/nameTag anchors)
function __hslToRgb(h, s, l) {
	let r, g, b;
	if (s === 0) { r = g = b = l; }
	else {
		const hue2rgb = function (p, q, t) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const pp = 2 * l - q;
		r = hue2rgb(pp, q, h + 1 / 3);
		g = hue2rgb(pp, q, h);
		b = hue2rgb(pp, q, h - 1 / 3);
	}
	return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function __applyOutlineGlow(mesh, colorHex) {
	if (!mesh || !mesh.material) return;
	try {
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
	} catch (e) { /* noop */ }
}
function __espEntity(h) {
	if (!h || !player || h.id == player.id) return;
	try {
		if (enabledModules["ESP"]) {
			const time = Date.now() / 5000;
			const hue = time % 1;
			const rgb = __hslToRgb(hue, 1, 0.5);
			const colorHex = (rgb.r << 16) + (rgb.g << 8) + rgb.b;
			const groups = [];
			if (h.mesh) {
				if (h.mesh.meshes) groups.push([h.mesh.meshes, 3]);
				if (h.mesh.armorMesh) groups.push([h.mesh.armorMesh, 4]);
			}
			for (const entry of groups) {
				const set = entry[0]; const order = entry[1];
				for (const key in set) {
					const mesh = set[key];
					if (!mesh || !mesh.material) continue;
					try {
						mesh.material.depthTest = false;
						mesh.renderOrder = order;
						mesh.material.color.setHex(colorHex);
						mesh.material.emissive.setHex(colorHex);
						mesh.material.emissiveIntensity = 0.8;
						__applyOutlineGlow(mesh, colorHex);
					} catch (e) { /* noop */ }
				}
			}
			try {
				if (h.mesh && h.mesh.capeMesh && h.mesh.capeMesh.children.length > 0) {
					const cape = h.mesh.capeMesh.children[0];
					if (cape.material) {
						cape.material.depthTest = false;
						cape.renderOrder = 5;
						cape.material.color.setHex(colorHex);
						cape.material.emissive.setHex(colorHex);
						cape.material.emissiveIntensity = 0.8;
						__applyOutlineGlow(cape, colorHex);
					}
				}
			} catch (e) { /* noop */ }
			try {
				if (h.mesh && h.mesh.hatMesh && h.mesh.hatMesh.children.length > 0) {
					const kids = h.mesh.hatMesh.children[0].children;
					for (const mesh of kids) {
						if (!mesh.material) continue;
						mesh.material.depthTest = false;
						mesh.renderOrder = 4;
						mesh.material.color.setHex(colorHex);
						mesh.material.emissive.setHex(colorHex);
						mesh.material.emissiveIntensity = 0.8;
						__applyOutlineGlow(mesh, colorHex);
					}
				}
			} catch (e) { /* noop */ }
		}
	} catch (e) { /* noop */ }
}
Bus.on("render", function () {
	try {
		if (!player) return;
		const list = worldEntities();
		// team colors (replaces updateNameTag anchor)
		try {
			for (const e of list) {
				if (e && e.profile && e.profile.cosmetics && e.profile.cosmetics.color) {
					try { e.team = e.profile.cosmetics.color; } catch (x) { /* noop */ }
				}
			}
		} catch (e) { /* noop */ }
		// ESP highlight
		if (enabledModules["ESP"]) {
			for (const h of list) __espEntity(h);
		}
		// nametags (replaces nameTag.visible anchor)
		if (typeof showNametags !== "undefined" && showNametags) {
			let streamer = false;
			try { streamer = !!(Options && Options.streamerMode && Options.streamerMode.value); } catch (e) { streamer = false; }
			let cat = "";
			try { cat = game && game.serverInfo ? game.serverInfo.serverCategory : ""; } catch (e) { cat = ""; }
			for (const e of list) {
				try {
					const mesh = e && e.mesh;
					const tag = mesh && mesh.nameTag;
					if (!tag) continue;
					tag.visible = (tagsWhileSneaking[1] || !e.sneak)
						&& !streamer
						&& (tagsInMM[1] || cat !== "murder");
				} catch (x) { /* noop */ }
			}
		}
	} catch (e) { /* noop */ }
});
// --- MurderMystery role scan (replaces MAIN_HAND equipment anchor)
const __mmSeen = {};
Bus.on("playerTick", function () {
	try {
		if (!murderMystery || !murderMystery.enabled || !player) return;
		const list = worldEntities();
		for (const e of list) {
			try {
				if (!e || e.id === player.id || !isPlayerEntity(e)) continue;
				let cur = null;
				try {
					cur = e.inventory && e.inventory.getCurrentItem ? e.inventory.getCurrentItem() :
						(e.getHeldItem ? e.getHeldItem() : null);
				} catch (x) { cur = null; }
				const key = cur && cur.getItem ? (cur.getItem() ? cur.getItem().constructor.name : "?") : "?";
				const seenKey = __mmSeen[e.id];
				__mmSeen[e.id] = key;
				if (!cur || key === seenKey) continue;
				try { handleMurderMysteryHook(e, cur); } catch (x) { /* noop */ }
			} catch (x) { /* noop */ }
		}
	} catch (e) { /* noop */ }
});
// --- TextGUI overlay (replaces drawSelectedItemStack/drawHintBox anchor;
// --- the old ctx$5 HUD context no longer exists after minification)
let __textGuiCanvas = null;
let __textGuiCtx = null;
let __logoImg = null;
function __drawOverlayImage(c, img, x, y, w, h) {
	try { c.drawImage(img, x, y, w, h); } catch (e) { /* noop */ }
}
Bus.on("render", function () {
	try {
		if (!enabledModules["TextGUI"]) {
			if (__textGuiCanvas) __textGuiCanvas.style.display = "none";
			return;
		}
		if (!__textGuiCanvas) {
			__textGuiCanvas = document.createElement("canvas");
			__textGuiCanvas.style.cssText = "position:fixed;top:0;right:0;pointer-events:none;z-index:9990;";
			document.body.appendChild(__textGuiCanvas);
			__textGuiCtx = __textGuiCanvas.getContext("2d");
			__logoImg = new Image();
			__logoImg.src = "https://raw.githubusercontent.com/ProgMEM-CC/miniblox.impact.client.updatedv2/refs/heads/main/favicon.png";
		}
		const W = window.innerWidth;
		const H = window.innerHeight;
		if (__textGuiCanvas.width !== W || __textGuiCanvas.height !== H) {
			__textGuiCanvas.width = W;
			__textGuiCanvas.height = H;
		}
		__textGuiCanvas.style.display = "block";
		const c = __textGuiCtx;
		c.clearRect(0, 0, W, H);
		const colorOffset = (Date.now() / 4000);
		const posX = 15;
		const posY = 17;
		let offset = 0;
		const filtered = Object.values(modules).filter(function (m) { return m.enabled && m.name !== "TextGUI"; });
		filtered.sort(function (a, b) {
			const at = a.name + (a.tag && a.tag.trim() ? " " + a.tag.trim() : "");
			const bt = b.name + (b.tag && b.tag.trim() ? " " + b.tag.trim() : "");
			c.font = textguisize[1] + "px " + textguifont[1];
			return c.measureText(at).width < c.measureText(bt).width ? 1 : -1;
		});
		for (const module of filtered) {
			offset++;
			const fontStyle = textguisize[1] + "px " + textguifont[1];
			c.font = fontStyle;
			const rainbowText = module.name;
			let modeText = "";
			try { modeText = module.tag && module.tag.trim() ? module.tag.trim() : ""; } catch (e) { modeText = ""; }
			const fullText = rainbowText + (modeText ? " " + modeText : "");
			const textWidth = c.measureText(fullText).width;
			const x = W - textWidth - posX;
			const y = posY + (textguisize[1] + 3) * offset;
			c.shadowColor = "black";
			c.shadowBlur = textguishadow[1] ? 4 : 0;
			c.shadowOffsetX = 1;
			c.shadowOffsetY = 1;
			c.fillStyle = "hsl(" + (((colorOffset - 0.025 * offset) % 1) * 360) + ",100%,50%)";
			c.textAlign = "left";
			c.textBaseline = "top";
			c.fillText(rainbowText, x, y);
			if (modeText) {
				const rw = c.measureText(rainbowText).width;
				c.fillStyle = "#bbbbbb";
				c.fillText(modeText, x + rw + 4, y);
			}
			c.shadowColor = "transparent";
			c.shadowBlur = 0;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 0;
		}
		try {
			if (__logoImg && __logoImg.complete && __logoImg.naturalWidth > 0) {
				const scale = 0.9;
				const lw = __logoImg.naturalWidth * scale;
				const lh = __logoImg.naturalHeight * scale;
				__drawOverlayImage(c, __logoImg, W - lw - 15, H - lh - 15, lw, lh);
			} else if (textureManager && textureManager.vapeTexture && textureManager.vapeTexture.image) {
				const logo = textureManager.vapeTexture.image;
				const scale = 0.9;
				__drawOverlayImage(c, logo, W - logo.width * scale - 15, H - logo.height * scale - 15, logo.width * scale, logo.height * scale);
			}
		} catch (e) { /* noop */ }
	} catch (e) { /* noop */ }
});

		await new Promise(function (resolve) {
			const loop = setInterval(function () {
				try {
					if (globalThis[storeName] && globalThis[storeName].modules) {
						clearInterval(loop);
						resolve();
					}
				} catch (e) { /* noop */ }
			}, 10);
		});
		globalThis[storeName].saveVapeConfig = saveVapeConfig;
		globalThis[storeName].loadVapeConfig = loadVapeConfig;
		globalThis[storeName].exportVapeConfig = exportVapeConfig;
		globalThis[storeName].importVapeConfig = importVapeConfig;
		loadVapeConfig();
		setInterval(function () {
			saveVapeConfig();
		}, 10000);
	}


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
	async function execute() {
		Object.defineProperty(globalThis, storeName, { value: {}, enumerable: false, configurable: true });
		await initCheat();
	}
	// No bundle blocking anymore: the game script runs untouched. We only
	// need its URL (dumps + import()) and runtime objects (hooks).
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			execute().catch(function (e) { console.error("[Impact] init failed:", e); });
		});
	} else {
		execute().catch(function (e) { console.error("[Impact] init failed:", e); });
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
		console.error("[Clickgui] Init failed:", err);
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

		// Old vape Styles
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

		// Notifications
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

		// Vape V4 GUI State
		let categoryPanel = null;
		let modulePanels = {};
		let settingsPanel = null;
		let selectedCategory = null;
		let bindingModule = null;

		// Save/Load GUI State
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
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			document.documentElement.style.setProperty("--vape-accent-alpha", `rgba(${r},${g},${b},0.12)`);
			document.documentElement.style.setProperty("--vape-accent-shadow", `rgba(${r},${g},${b},0.2)`);
			localStorage.setItem("vape-accent-color", color);
		}

		const savedColor = localStorage.getItem("vape-accent-color");
		if (savedColor) {
			setAccentColor(savedColor);
		}

		function createPanel(title, x, y, width, showCollapseButton = false) {
			const panel = document.createElement("div");
			panel.className = "vape-panel";
			panel.style.position = "absolute";
			
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

			if (showCollapseButton) {
				const collapseBtn = document.createElement("div");
				collapseBtn.className = "vape-collapse-btn";
				collapseBtn.textContent = "−";
				collapseBtn.style.cssText = "width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:16px;font-weight:700;transition:all 0.2s;user-select:none;";
				collapseBtn.title = "Collapse";

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

		// Create Category Panel
		function createCategoryPanel() {
			const { panel, content } = createPanel("Impact V9 FINAL UPDATE", 40, 40, 220);
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

		// Update category highlights based on open panels
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

    // Bind display
    const bindDisplay = document.createElement("span");
    bindDisplay.className = "vape-bind-display";

    // Check if module has a bind when creating the display
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
            // Bind display at top
            const bindKeyDisplay = document.createElement("div");
            bindKeyDisplay.className = "vape-bind-key-display";

            // Show current bind or "CLICK TO BIND"
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

		// Close Panel with Animation
		function closePanelWithAnimation(panel, callback) {
			panel.classList.add("closing");
			setTimeout(() => {
				panel.remove();
				if (callback) callback();
			}, 200);
		}

		// Open Module Panel
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

		// Toggle GUI
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
						// Updates both displays
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
		}, true);

		setTimeout(() => { showNotif("Press \\\\ to open Impact V9 FINAL", "info", 4000); }, 500);
	}
})();
