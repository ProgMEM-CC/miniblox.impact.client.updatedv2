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