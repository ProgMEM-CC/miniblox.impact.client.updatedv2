let scaffoldtower, oldHeld, scaffoldextend, scaffoldcycle;
let tickCount = 0;

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

const scaffold = new Module("DevScaffold", function(callback) {
    if (callback) {
        if (player) oldHeld = game.info.selectedSlot;

        tickLoop["DevScaffold"] = function() {
            tickCount++;

            // 🔁 Auto-select blocks & cycle between them
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
                switchSlot(slotsWithBlocks[0]); // fallback
            }

            const item = player.inventory.getCurrentItem();
            if (!item || !(item.getItem() instanceof ItemBlock)) return;

            let flooredX = Math.floor(player.pos.x);
            let flooredY = Math.floor(player.pos.y);
            let flooredZ = Math.floor(player.pos.z);

            let futureX = player.pos.x + player.motion.x;
            let futureZ = player.pos.z + player.motion.z;
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
                        let closestSide = null;
                        let closestPos = null;
                        let closestDist = Infinity;

                        for (let x = -5; x <= 5; x++) {
                            for (let z = -5; z <= 5; z++) {
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

                        if (scaffoldextend[1] > 0) {
                            offsetX *= scaffoldextend[1];
                            offsetZ *= scaffoldextend[1];
                        }

                        const placeX = pos.x + offsetX;
                        const placeY = keyPressedDump("shift")
                            ? pos.y - (dir.y + 2)
                            : pos.y + dir.y;
                        const placeZ = pos.z + offsetZ;

                        const placePosition = new BlockPos(placeX, placeY, placeZ);

                        function randomFaceOffset(face) {
                            const rand = () => 0.1 + Math.random() * 0.8;
                            if (face.getAxis() === "Y") {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + (face === EnumFacing.UP ? 0.95 : 0.05) + Math.random() * 0.04,
                                    z: placePosition.z + rand()
                                };
                            } else if (face.getAxis() === "X") {
                                return {
                                    x: placePosition.x + (face === EnumFacing.EAST ? 0.95 : 0.05) + Math.random() * 0.04,
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + rand()
                                };
                            } else {
                                return {
                                    x: placePosition.x + rand(),
                                    y: placePosition.y + rand(),
                                    z: placePosition.z + (face === EnumFacing.SOUTH ? 0.95 : 0.05) + Math.random() * 0.04
                                };
                            }
                        }

                        const hitOffsets = randomFaceOffset(placeSide);
                        const hitVec = new Vector3$1(hitOffsets.x, hitOffsets.y, hitOffsets.z);

                        const dx = hitVec.x - player.pos.x;
                        const dy = hitVec.y - (player.pos.y + player.getEyeHeight());
                        const dz = hitVec.z - player.pos.z;
                        const distHorizontal = Math.sqrt(dx * dx + dz * dz);

                        const rotYaw = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
                        const rotPitch = -Math.atan2(dy, distHorizontal) * (180 / Math.PI);
                        player.rotationYaw = rotYaw;
                        player.rotationPitch = Math.max(-90, Math.min(90, rotPitch));

                        if (
                            scaffoldtower[1] &&
                            keyPressedDump("space") &&
                            dir.y === -1 &&
                            Math.abs(player.pos.x - flooredX - 0.5) < 0.2 &&
                            Math.abs(player.pos.z - flooredZ - 0.5) < 0.2
                        ) {
                            if (player.motion.y < 0.2 && player.motion.y > 0.15) {
                                player.motion.y = 0.42;
                            }
                        }

                        if (keyPressedDump("shift") && dir.y === 1) {
                            if (player.motion.y > -0.2 && player.motion.y < -0.15) {
                                player.motion.y = -0.42;
                            }
                        }

                        if (playerControllerDump.onPlayerRightClick(player, game.world, item, placePosition, placeSide, hitVec)) {
                            hud3D.swingArm();
                        }

                        if (item.stackSize === 0) {
                            player.inventory.main[player.inventory.currentItem] = null;
                        }
                    }

                    break; // ✅ Stop checking after placing
                }
            }
        };
    } else {
        if (player && oldHeld !== undefined) {
            switchSlot(oldHeld);
        }
        delete tickLoop["DevScaffold"];
    }
});

scaffoldtower = scaffold.addoption("Tower", Boolean, true);
scaffoldextend = scaffold.addoption("Extend", Number, 1);
scaffoldcycle = scaffold.addoption("CycleSpeed", Number, 10);