/**
 * Breaker Module
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
