new Module("AntiFall", function(callback) {
    if (callback) {
        let ticks = 0;
        tickLoop["AntiFall"] = function() {
            const ray = rayTraceBlocks(player.getEyePos(), player.getEyePos().clone().setY(0), false, false, false, game.world);
            if (!ray) {
                player.motion.y = 0;
            }
        };
    }
    else delete tickLoop["AntiFall"];
});