// ChestSteal module
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

            // Check if we have a chest open
            if (player.openContainer &&
                player.openContainer instanceof ContainerChest &&
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
            if (!player.openContainer || !(player.openContainer instanceof ContainerChest)) {
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