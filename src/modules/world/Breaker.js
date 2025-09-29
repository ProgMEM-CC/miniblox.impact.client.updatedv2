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