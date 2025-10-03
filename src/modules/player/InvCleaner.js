const InvCleaner = new Module("InvCleaner", function (callback) {
    if (!callback) {
        delete tickLoop["InvCleaner"];
        return;
    }

    const armorPriority = ["leather", "chain", "iron", "diamond"];
    const weaponClasses = new Set(["ItemSword", "ItemAxe", "ItemBow", "ItemPickaxe"]);
    const essentials = ["gapple", "golden apple", "ender pearl", "fire charge"];
    const customKeep = ["god helmet", "legend boots"];
    const bestArmor = {};
    const bestItems = {};
    let lastRun = 0;

    function getArmorScore(stack) {
        const item = stack.getItem();
        const material = item.getArmorMaterial?.()?.toLowerCase?.() ?? "unknown";
        const priority = armorPriority.indexOf(material);
        const durability = stack.getMaxDamage() - stack.getItemDamage();
        return (priority === -1 ? -999 : priority * 1000) + durability;
    }

    function getMaterialScore(name) {
        name = name.toLowerCase();
        if (name.includes("diamond")) return 4;
        if (name.includes("iron")) return 3;
        if (name.includes("chain")) return 2;
        if (name.includes("wood")) return 1;
        return 0;
    }

    function getScore(stack, item) {
        const damage = item.getDamageVsEntity?.() ?? 0;
        const enchants = stack.getEnchantmentTagList()?.length ?? 0;
        const material = getMaterialScore(stack.getDisplayName());
        return damage + enchants * 1.5 + material * 0.5;
    }

    function isSameItem(a, b) {
        if (!a || !b) return false;
        const nameA = a.stack.getDisplayName()?.toLowerCase();
        const nameB = b.stack.getDisplayName()?.toLowerCase();
        const enchA = a.stack.getEnchantmentTagList()?.toString();
        const enchB = b.stack.getEnchantmentTagList()?.toString();
        return nameA === nameB && enchA === enchB;
    }

    function shouldKeep(stack) {
        const name = stack.getDisplayName().toLowerCase();
        return essentials.some(k => name.includes(k)) || customKeep.some(k => name.includes(k));
    }

    tickLoop["InvCleaner"] = function () {
        const now = Date.now();
        if (now - lastRun < 100) return;
        lastRun = now;

        const slots = player?.inventoryContainer?.inventorySlots;
        if (!player.openContainer || player.openContainer !== player.inventoryContainer || !slots || slots.length < 36) return;

        Object.keys(bestArmor).forEach(k => delete bestArmor[k]);
        Object.keys(bestItems).forEach(k => delete bestItems[k]);

        const toDrop = [];

        // Preload equipped armor
        [5, 6, 7, 8].forEach(i => {
            const stack = slots[i]?.getStack();
            if (stack?.getItem() instanceof ItemArmor) {
                const armorType = stack.getItem().armorType ?? "unknown";
                bestArmor["armor_" + armorType] = { stack, index: i };
            }
        });

        for (let i = 0; i < 36; i++) {
            const stack = slots[i]?.getStack();
            if (!stack) continue;

            const item = stack.getItem();
            const className = item.constructor.name;

            if (shouldKeep(stack)) continue;

            if (item instanceof ItemBlock) {
                if (stack.stackSize < 5) toDrop.push(i);
                continue;
            }

            if (item instanceof ItemArmor) {
    const armorType = item.armorType ?? "unknown";
    const key = "armor_" + armorType;
    const score = getArmorScore(stack);
    const existing = bestArmor[key];

    if (!existing) {
        bestArmor[key] = { stack, index: i, score };
    } else {
        const existingScore = existing.score;
        if (score > existingScore) {
            toDrop.push(existing.index);
            bestArmor[key] = { stack, index: i, score };
        } else {
            toDrop.push(i); // drop lower-score armor
        }
    }
    continue;
}

            if (weaponClasses.has(className)) {
                const score = getScore(stack, item);
                const existing = bestItems[className];

                if (!existing || score > existing.score) {
                    if (existing && existing.index !== i) toDrop.push(existing.index);
                    bestItems[className] = { stack, score, index: i };
                } else if (existing && isSameItem(bestItems[className], { stack })) {
                    toDrop.push(i); // Drop exact duplicate
                } else {
                    toDrop.push(i);
                }
                continue;
            }

            toDrop.push(i);
        }

        toDrop.forEach(dropSlot);
    };
});

function dropSlot(index) {
    const windowId = player.openContainer.windowId;
    playerControllerDump.windowClickDump(windowId, index, 0, 0, player);
    playerControllerDump.windowClickDump(windowId, -999, 0, 0, player); // drop outside of the window
}