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