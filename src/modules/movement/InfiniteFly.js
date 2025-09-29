let infiniteFlyVert;
const infiniteFly = new Module("InfiniteFly", function(callback) {
    if (callback) {
        let ticks = 0;
        tickLoop["InfiniteFly"] = function() {
            ticks++;
            const dir = getMoveDirection(0.2);
            player.motion.x = dir.x;
            player.motion.z = dir.z;
            const goUp = keyPressedDump("space");
            const goDown = keyPressedDump("shift");
            if (goUp || goDown) {
                player.motion.y = goUp ? infiniteFlyVert[1] : -infiniteFlyVert[1];
            } else {
                player.motion.y = 0;
            }
        };
    }
    else {
        delete tickLoop["InfiniteFly"];
        if (player) {
            player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
            player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
        }
    }
});
infiniteFlyVert = infiniteFly.addoption("Vertical", Number, 0.3);