(() => {
	console.log("%c[AutoDrop] 🚀 Injecting AutoDrop v4.3...", "color: #0f0; font-weight: bold");

	// --- Hook into player object ---
	const originalDefine = Object.defineProperty;
	Object.defineProperty = function (target, prop, descriptor) {
		if (prop === "inventoryContainer" && !window.__hookedPlayer) {
			console.log("🎯 Hooked player via defineProperty:", target);
			window.__hookedPlayer = target;
		}
		return originalDefine(target, prop, descriptor);
	};

	// --- Wait for __hookedPlayer to appear ---
	const waitForPlayer = setInterval(() => {
		if (window.__hookedPlayer && window.__hookedPlayer.inventoryContainer) {
			clearInterval(waitForPlayer);
			console.log("%c[AutoDrop] ✅ Player object hooked!", "color: #0f0");

			const player = window.__hookedPlayer;

			// === AutoDrop Logic ===
			const dropQueue = [];
			let dropCooldown = 0;
			const tickLoop = {};

			function validateAndDrop(index, tries = 0) {
				const windowId = player?.openContainer?.windowId ?? -1;
				if (windowId === -1 || tries >= 2) return;

				const slot = player.inventoryContainer.inventorySlots[index];
				if (!slot || !slot.getHasStack()) return;

				const pre = slot.getStack();
				dropQueue.push(() => {
					playerControllerDump.windowClickDump(windowId, index, 4, 0, player);
					setTimeout(() => {
						const slotAfter = player.inventoryContainer.inventorySlots[index];
						if (slotAfter?.getHasStack() && slotAfter.getStack().isItemEqual(pre)) {
							validateAndDrop(index, tries + 1);
						}
					}, 50);
				});
			}

			tickLoop["AutoDrop_DropHandler"] = function () {
				if (dropCooldown > 0) {
					dropCooldown--;
					return;
				}
				if (dropQueue.length > 0) {
					dropQueue.shift()();
					dropCooldown = 3 + Math.floor(Math.random() * 2);
				}
			};

			const armorPriority = { leather: 1, chain: 2, iron: 3, diamond: 4 };
			const weaponPriority = { wood: 1, stone: 2, iron: 3, diamond: 4 };
			const toolPriority = { wood: 1, stone: 2, iron: 3, diamond: 4 };

			function getTier(name, map) {
				name = name.toLowerCase();
				for (const key in map) if (name.includes(key)) return { tier: key, value: map[key] };
				return { tier: "unknown", value: 0 };
			}

			const AutoDrop = new Module("AutoDrop", function (enabled) {
				if (enabled) {
					let dropVisuals = [];
					tickLoop["AutoDrop"] = function () {
						dropVisuals = [];
						if (!player.openContainer || player.openContainer !== player.inventoryContainer) return;

						const slots = player.inventoryContainer.inventorySlots;
						const keptTypes = new Set();
						const bestArmor = { 0: null, 1: null, 2: null, 3: null };
						AutoDrop.bestWeapon = null;
						AutoDrop.bestTools = { pickaxe: null, axe: null };

						for (let i = 0; i < 36; i++) {
							const slot = slots[i];
							if (!slot || !slot.getHasStack()) continue;

							const stack = slot.getStack();
							const item = stack.getItem();
							const name = stack.getDisplayName().toLowerCase();

							if (
								name.includes("gapple") ||
								name.includes("golden apple") ||
								name.includes("ender pearl") ||
								name.includes("fire charge")
							) continue;

							if (item instanceof ItemBlock) {
								if (stack.stackSize >= 5) continue;
								validateAndDrop(i);
								dropVisuals.push(i);
								continue;
							}

							if (item instanceof ItemArmor) {
								const slotType = item.armorType;
								const { value: tierValue } = getTier(name, armorPriority);
								const durability = stack.getMaxDamage() > 0
									? (stack.getMaxDamage() - stack.getItemDamage()) / stack.getMaxDamage()
									: 1;
								const current = bestArmor[slotType];
								if (!current || tierValue > current.tier || (tierValue === current.tier && durability > current.durability)) {
									if (current && current.index !== -1) {
										validateAndDrop(current.index);
										dropVisuals.push(current.index);
									}
									bestArmor[slotType] = { index: i, tier: tierValue, durability };
								} else {
									validateAndDrop(i);
									dropVisuals.push(i);
								}
								continue;
							}

							if (item instanceof ItemSword) {
								const { value: tierValue } = getTier(name, weaponPriority);
								const durability = stack.getMaxDamage() > 0
									? (stack.getMaxDamage() - stack.getItemDamage()) / stack.getMaxDamage()
									: 1;
								const best = AutoDrop.bestWeapon;
								if (!best || tierValue > best.tier || (tierValue === best.tier && durability > best.durability)) {
									if (best && best.index !== -1) {
										validateAndDrop(best.index);
										dropVisuals.push(best.index);
									}
									AutoDrop.bestWeapon = { index: i, tier: tierValue, durability };
								} else {
									validateAndDrop(i);
									dropVisuals.push(i);
								}
								continue;
							}

							if (item instanceof ItemTool) {
								const type = name.includes("pick") ? "pickaxe" : name.includes("axe") ? "axe" : null;
								if (!type) continue;
								const { value: tierValue } = getTier(name, toolPriority);
								const durability = stack.getMaxDamage() > 0
									? (stack.getMaxDamage() - stack.getItemDamage()) / stack.getMaxDamage()
									: 1;
								const current = AutoDrop.bestTools[type];
								if (!current || tierValue > current.tier || (tierValue === current.tier && durability > current.durability)) {
									if (current && current.index !== -1) {
										validateAndDrop(current.index);
										dropVisuals.push(current.index);
									}
									AutoDrop.bestTools[type] = { index: i, tier: tierValue, durability };
								} else {
									validateAndDrop(i);
									dropVisuals.push(i);
								}
								continue;
							}

							const typeKey = item.constructor.name + "_" + name;
							if (!keptTypes.has(typeKey)) {
								keptTypes.add(typeKey);
								continue;
							}
							validateAndDrop(i);
							dropVisuals.push(i);
						}
					};
					console.log("%c[AutoDrop] ✅ Running!", "color: cyan");
				} else {
					delete tickLoop["AutoDrop"];
					delete tickLoop["AutoDrop_DropHandler"];
					console.log("%c[AutoDrop] ❌ Disabled", "color: red");
				}
			});

			// Activate module automatically
			AutoDrop(true);
		}
	}, 500);
})();
