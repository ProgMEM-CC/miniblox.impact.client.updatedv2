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