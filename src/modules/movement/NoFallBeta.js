let noFallExtraYBeta;
const NoFallBeta = new Module("NoFallBeta", function(callback) {
    if (callback) {
        tickLoop["NoFallBeta"] = function() {
            // check if the player is falling and above a block
            // player.fallDistance = 0;
            const boundingBox = player.getEntityBoundingBox();
            const clone = boundingBox.min.clone();
            clone.y -= noFallExtraYBeta[1];
            const block = rayTraceBlocks(boundingBox.min, clone, true, false, false, game.world);
            if (block) {
                sendY = player.pos.y + noFallExtraYBeta[1];
            }
        }
    } else {
        delete tickLoop["NoFallBeta"];
    }
});
noFallExtraYBeta = NoFallBeta.addoption("extraY", Number, .41);