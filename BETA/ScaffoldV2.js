// Scaffold Module - Better AC Bypass + Sprint Support (does this work?)
let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle, scaffoldSafeMode, scaffoldSprint;
let tickCount = 0;
let lastPlaceTime = 0;
let placeDelay = 0;
let wasSprintingBeforeScaffold = false;

function getPossibleSides(pos) {
    const possibleSides = [];
    for (const side of EnumFacing.VALUES) {
        const offset = side.toVector();
        const state = game.world.getBlockState(pos.add(offset.x, offset.y, offset.z));
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

const scaffold = new Module("Scaffold", function(callback) {
    if (callback) {
        if (player) {
            oldHeld = game.info.selectedSlot;
            wasSprintingBeforeScaffold = player.isSprinting();
        }

        game.chat.addChat({
            text: "Improved scaffold loaded - SafeMode: " + (scaffoldSafeMode[1] ? "ON" : "OFF") + " | Sprint: " + (scaffoldSprint[1] ? "ON" : "OFF"),
            color: "lime"
        });

        tickLoop["Scaffold"] = function() {
            tickCount++;

            // Handle sprinting
            if (scaffoldSprint[1]) {
                // Keep sprint enabled while scaffolding
                if (!player.isSprinting() && (player.moveForwardDump !== 0 || player.moveStrafeDump !== 0)) {
                    player.setSprinting(true);
                }
            } else {
                // Disable sprint for more stable placement
                if (player.isSprinting()) {
                    player.setSprinting(false);
                }
            }

            // Dynamic delay based on SafeMode and Sprint
            const currentTime = Date.now();
            let minDelay = scaffoldSafeMode[1] ? 100 : 50;

            // Faster placement when sprinting if enabled
            if (scaffoldSprint[1] && player.isSprinting()) {
                minDelay = scaffoldSafeMode[1] ? 75 : 40;
            }

            if (currentTime - lastPlaceTime < minDelay) return;

            // Auto-select blocks & cycle between them
            let slotsWithBlocks = [];
            for (let i = 0; i < 9; i++) {
                const item = player.inventory.main[i];
                if (
                    item &&
                    item.item instanceof ItemBlock &&
                    item.item.block.getBoundingBox().max.y === 1 &&
                    item.item.name !== "tnt"
                ) {
                    slotsWithBlocks.push(i);
                }
            }

            if (slotsWithBlocks.length >= 2) {
                const selected = Math.floor(tickCount / scaffoldcycle[1]) % slotsWithBlocks.length;
                switchSlot(slotsWithBlocks[selected]);
            } else if (slotsWithBlocks.length > 0) {
                switchSlot(slotsWithBlocks[0]);
            }

            const item = player.inventory.getCurrentItem();
            if (!item || !(item.getItem() instanceof ItemBlock)) return;

            // Use current position for safer placement
            let flooredX = Math.floor(player.pos.x);
            let flooredY = Math.floor(player.pos.y);
            let flooredZ = Math.floor(player.pos.z);

            // Predict future position more aggressively when sprinting
            let futureX = player.pos.x;
            let futureZ = player.pos.z;

            if (!scaffoldSafeMode[1] || scaffoldSprint[1]) {
                const speed = Math.sqrt(player.motion.x * player.motion.x + player.motion.z * player.motion.z);
                // Increase prediction multiplier when sprinting
                const predictionMultiplier = (scaffoldSprint[1] && player.isSprinting()) ? 0.8 : 0.5;

                if (speed > 0.15) {
                    futureX += player.motion.x * predictionMultiplier;
                    futureZ += player.motion.z * predictionMultiplier;
                }
            }

            let flooredFutureX = Math.floor(futureX);
            let flooredFutureZ = Math.floor(futureZ);

            let positionsToCheck = [
                new BlockPos(flooredX, flooredY - 1, flooredZ),
                new BlockPos(flooredFutureX, flooredY - 1, flooredFutureZ)
            ];

            for (let pos of positionsToCheck) {
                if (game.world.getBlockState(pos).getBlock().material === Materials.air) {
                    let placeSide = getPossibleSides(pos);

                    if (!placeSide) {
                        // Reduced search range for safer placement
                        let closestSide = null;
                        let closestPos = null;
                        let closestDist = Infinity;
                        const searchRange = scaffoldSafeMode[1] ? 3 : 5;

                        for (let x = -searchRange; x <= searchRange; x++) {
                            for (let z = -searchRange; z <= searchRange; z++) {
                                const newPos = new BlockPos(pos.x + x, pos.y, pos.z + z);
                                const side = getPossibleSides(newPos);
                                if (side) {
                                    const dist = player.pos.distanceTo(new Vector3$1(newPos.x, newPos.y, newPos.z));
                                    if (dist < closestDist) {
                                        closestDist = dist;
                                        closestSide = side;
                                        closestPos = newPos;
                                    }
                                }
                            }
                        }

                        if (closestPos) {
                            pos = closestPos;
                            placeSide = closestSide;
                        }
                    }

                    if (placeSide) {
                        const dir = placeSide.getOpposite().toVector();

                        let offsetX = dir.x;
                        let offsetY = dir.y;
                        let offsetZ = dir.z;

                        // Reduced extend in SafeMode
                        const extendAmount = scaffoldSafeMode[1] ? Math.min(scaffoldextend[1], 1) : scaffoldextend[1];
                        if (extendAmount > 0) {
                            offsetX *= extendAmount;
                            offsetZ *= extendAmount;
                        }

                        const placeX = pos.x + offsetX;
                        const placeY = keyPressedDump("shift")
                            ? pos.y - (dir.y + 2)
                            : pos.y + dir.y;
                        const placeZ = pos.z + offsetZ;

                        const placePosition = new BlockPos(placeX, placeY, placeZ);

                        // More natural hit position randomization
                        function randomFaceOffset(face) {
                            const rand = () => 0.15 + Math.random() * 0.7;
                            const smallRand = () => Math.random() * 0.08;

                            if (face.getAxis() === "Y") {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + (face === EnumFacing.UP ? 0.92 : 0.08) + smallRand(),
                                    z: placePosition.z + rand()
                                };
                            } else if (face.getAxis() === "X") {
                                return {
                                    x: placePosition.x + (face === EnumFacing.EAST ? 0.92 : 0.08) + smallRand(),
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + rand()
                                };
                            } else {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + (face === EnumFacing.SOUTH ? 0.92 : 0.08) + smallRand()
                                };
                            }
                        }

                        const hitOffsets = randomFaceOffset(placeSide);
                        const hitVec = new Vector3$1(hitOffsets.x, hitOffsets.y, hitOffsets.z);

                        const dx = hitVec.x - player.pos.x;
                        const dy = hitVec.y - (player.pos.y + player.getEyeHeight());
                        const dz = hitVec.z - player.pos.z;
                        const distHorizontal = Math.sqrt(dx * dx + dz * dz);

                        // Smoother rotation with faster adjustment when sprinting
                        const targetYaw = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
                        const targetPitch = -Math.atan2(dy, distHorizontal) * (180 / Math.PI);

                        // Faster lerp when sprinting for quicker block placement
                        let lerpFactor = scaffoldSafeMode[1] ? 0.3 : 0.5;
                        if (scaffoldSprint[1] && player.isSprinting()) {
                            lerpFactor = 0.7; // Much faster rotation when sprinting
                        }

                        player.rotationYaw += (targetYaw - player.rotationYaw) * lerpFactor;
                        player.rotationPitch += (Math.max(-90, Math.min(90, targetPitch)) - player.rotationPitch) * lerpFactor;

                        // Tower mode with better Y control
                        if (
                            scaffoldtower[1] &&
                            keyPressedDump("space") &&
                            dir.y === -1 &&
                            Math.abs(player.pos.x - flooredX - 0.5) < 0.25 &&
                            Math.abs(player.pos.z - flooredZ - 0.5) < 0.25
                        ) {
                            // More conservative tower boost
                            if (player.motion.y < 0.18 && player.motion.y > 0.12) {
                                player.motion.y = scaffoldSafeMode[1] ? 0.38 : 0.42;
                            }
                        }

                        // Downward scaffold with better control
                        if (keyPressedDump("shift") && dir.y === 1) {
                            if (player.motion.y > -0.18 && player.motion.y < -0.12) {
                                player.motion.y = scaffoldSafeMode[1] ? -0.38 : -0.42;
                            }
                        }

                        // Place block
                        if (playerControllerDump.onPlayerRightClick(player, game.world, item, placePosition, placeSide, hitVec)) {
                            hud3D.swingArm();
                            lastPlaceTime = currentTime;

                            // Add small random delay variation
                            if (scaffoldSafeMode[1]) {
                                placeDelay = 100 + Math.random() * 50;
                            }
                        }

                        if (item.stackSize === 0) {
                            player.inventory.main[player.inventory.currentItem] = null;
                        }
                    }

                    break; // Stop after first valid placement
                }
            }
        };
    } else {
        if (player && oldHeld !== undefined) {
            switchSlot(oldHeld);
        }

        // Restore sprint state if it was on before
        if (player && wasSprintingBeforeScaffold && !player.isSprinting()) {
            player.setSprinting(true);
        }

        delete tickLoop["Scaffold"];
        lastPlaceTime = 0;
        placeDelay = 0;
    }
}, "World");

// Module options
scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);
scaffoldSafeMode = scaffold.addoption("SafeMode", Boolean, true); // Safer placement mode
scaffoldSprint = scaffold.addoption("Sprint", Boolean, true); // NEW: Allow sprinting while scaffolding
