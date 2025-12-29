// Scaffold with rots 🤑🤑
// TODO: make this better for skywars if we can!
let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle, scaffoldRotations;
let tickCount = 0;

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

const scaffold = new Module("Scaffold", function(callback) {
    if (callback) {
        if (player) oldHeld = game.info.selectedSlot;

        game.chat.addChat({
            text: "Scaffold enabled!",
            color: "lime"
        });

        tickLoop["Scaffold"] = function() {
            tickCount++;

            // Auto-select blocks & cycle
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

            // Calculate positions - MORE AGGRESSIVE PREDICTION
            const playerX = Math.floor(player.pos.x);
            const playerY = Math.floor(player.pos.y);
            const playerZ = Math.floor(player.pos.z);

            // Predict further ahead based on motion
            const predictionMultiplier = scaffoldextend[1] * 2; // 2x for skywars speed
            const futureX = player.pos.x + player.motion.x * predictionMultiplier;
            const futureZ = player.pos.z + player.motion.z * predictionMultiplier;
            const flooredFutureX = Math.floor(futureX);
            const flooredFutureZ = Math.floor(futureZ);

            // Check MORE positions for faster bridging
            const positionsToCheck = [
                new BlockPos(flooredFutureX, playerY - 1, flooredFutureZ), // Future position first!
                new BlockPos(playerX, playerY - 1, playerZ),
            ];

            // Also check diagonal positions for fast strafing
            if (Math.abs(player.motion.x) > 0.1 || Math.abs(player.motion.z) > 0.1) {
                positionsToCheck.push(
                    new BlockPos(flooredFutureX, playerY - 1, playerZ),
                    new BlockPos(playerX, playerY - 1, flooredFutureZ)
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

                // Calculate rotation to hit vec (ONLY IF ROTATIONS ENABLED)
                if (scaffoldRotations[1]) {
                    const dx = hitVec.x - player.pos.x;
                    const dy = hitVec.y - (player.pos.y + player.getEyeHeight());
                    const dz = hitVec.z - player.pos.z;
                    const distHorizontal = Math.sqrt(dx * dx + dz * dz);

                    const targetYaw = (Math.atan2(dz, dx) * 180 / Math.PI) - 90;
                    const targetPitch = -(Math.atan2(dy, distHorizontal) * 180 / Math.PI);

                    // Set rotation using sendYaw
                    sendYaw = targetYaw * (Math.PI / 180);
                }

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
                    hud3D.swingArm();
                    
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
        sendYaw = false;
    }
}, "World");

scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);
scaffoldRotations = scaffold.addoption("Rotations", Boolean, true);
