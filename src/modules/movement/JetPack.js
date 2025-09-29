let jetpackvalue, jetpackvert, jetpackUpMotion, jetpackGlide;
// jetpack
const jetpack = new Module("JetPack", function(callback) {
    if (callback) {
        let ticks = 0;
        tickLoop["JetPack"] = function() {
            ticks++;
            const dir = getMoveDirection(jetpackvalue[1]);
            player.motion.x = dir.x;
            player.motion.z = dir.z;
            const goUp = keyPressedDump("space");
            const goDown = false; 		//keyPressedDump("shift"), might not be needed
            if (goUp || goDown) {
                player.motion.y = goUp ? jetpackvert[1] : -jetpackvert[1];
            } else {
                player.motion.y = (ticks < 18 && ticks % 6 < 4 ? jetpackUpMotion[1] : -jetpackGlide[1]);
            }
        };
    }
    else {
        delete tickLoop["JetPack"];
        if (player) {
            player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
            player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
        }
    }
});
jetpackvalue = jetpack.addoption("Speed", Number, 0.18);
jetpackGlide = jetpack.addoption("Glide", Number, 0.27);
jetpackUpMotion = jetpack.addoption("UpMotion", Number, 0.27);
jetpackvert = jetpack.addoption("Vertical", Number, 0.27);