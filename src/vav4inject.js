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
	addDump('moveForwardDump', 'this\\.([a-zA-Z]+)=\\([a-zA-Z]+\\.up|down)');
	addDump('keyPressedDump', 'function ([a-zA-Z]*)\\([a-zA-Z]*\\)\\{return keyPressed\\([a-zA-Z]*\\)');
	addDump('entitiesDump', 'this\.([a-zA-Z]*)\.values\(\)\)[a-zA-Z]* instanceof EntityTNTPrimed');
	addDump('isInvisibleDump', '[a-zA-Z]*\.([a-zA-Z]*)\\(\)\\)&&\\([a-zA-Z]*=new ([a-zA-Z]*)\(new');
	addDump('attackDump', 'hitVec.z\\}\\) \\}\\) \\)\\),player\\.([a-zA-Z]*)');
	addDump('lastReportedYawDump', 'this\.([a-zA-Z]*)=this\.yaw,this\.last');
	addDump('windowClickDump', '([a-zA-Z]*)\\(this\.inventorySlots\.windowId');
	addDump('playerControllerDump', 'const ([a-zA-Z]*)=new PlayerController,');
	addDump('damageReduceAmountDump', 'ItemArmor&&\\([a-zA-Z]*\\+\\=\\ [a-zA-Z]*\\.([a-zA-Z]*)');
	addDump('boxGeometryDump', 'w=new Mesh\\(new ([a-zA-Z]*)\\(1');
	addDump('syncItemDump', 'playerControllerMP\\.([a-zA-Z]*)\\( \\),ClientSocket.sendPacket');

	// PRE
	addModification('document.addEventListener("DOMContentLoaded",startGame,!1);', "\n\t\tsetTimeout(function() {\n\t\t\tvar DOMContentLoaded_event = document.createEvent(\"Event\");\n\t\t\tDOMContentLoaded_event.initEvent(\"DOMContentLoaded\", true, true);\n\t\t\tdocument.dispatchEvent(DOMContentLoaded_event);\n\t\t}, 0);\n");
	addModification('y:this.getEntityBoundingBox().min.y,', 'y:sendY != false ? sendY : this.getEntityBoundingBox().min.y,', true);
	addModification('Potions.jump.getId()","5");', "\n\t\t\tlet blocking = false;\n\t\t\tlet sendYaw = false;\n\t\t\tlet sendY = false;\n\t\t\tlet breakStart = Date.now();\n\t\t\tlet noMove = Date.now();\n\n\t\t\tlet enabledModules = {};\n\t\t\tlet modules = {};\n\n\t\t\tlet keybindCallbacks = {};\n\t\t\tlet keybindList = {};\n\n\t\t\tlet tickLoop = {};\n\t\t\tlet renderTickLoop = {};\n\n\t\t\tlet lastJoined, velocityhori, velocityvert, chatdisablermsg, textguifont, textguisize, textguishadow, attackedEntity, stepheight;\n\t\t\tlet attackTime = Date.now();\n\t\t\tlet chatDelay = Date.now();\n\n\t\t\tfunction getModule(str) {\n\t\t\t\tfor(const [name, module] of Object.entries(modules)) {\n\t\t\t\t\tif (name.toLocaleLowerCase() == str.toLocaleLowerCase()) return module;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tlet j;\n\t\t\tfor (j = 0; j < 26; j++) keybindList[j + 65] = keybindList[\"Key\" + String.fromCharCode(j + 65)] = String.fromCharCode(j + 97);\n\t\t\tfor (j = 0; j < 10; j++) keybindList[48 + j] = keybindList[\"Digit\" + j] = \"" + j;\n\t\t\twindow.addEventListener(\"keydown\", function(key) {\n\t\t\t\tconst func = keybindCallbacks[keybindList[key.code]];\n\t\t\t\tif (func) func(key);\n\t\t\t});\n\t");

	addModification('VERSION$1," | ",', `"${vapeName} v${VERSION}"," | ",`);
	addModification('if(!x.canConnect){', 'x.errorMessage = x.errorMessage === "Could not join server. You are connected to a VPN or proxy. Please disconnect from it and refresh the page." ? "You\'re maybe IP banned or you\'re using a vpn " : x.errorMessage;');

	// DRAWING SETUP
	addModification('I(this,"glintTexture");', "\n\t\tI(this, \"vapeTexture\");\n\t\tI(this, \"v4Texture\");\n\t");
	const corsMoment = url => {
		return new URL(`https://corsproxy.io/?url=${url}`).href;
	}
	addModification('skinManager.loadTextures(),', ',this.loadVape(),');
	addModification('async loadSpritesheet(){', `
		async loadVape() {
			this.vapeTexture = await this.loader.loadAsync("${corsMoment(