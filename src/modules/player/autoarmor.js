/**
 * AutoArmor Module
 */

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
