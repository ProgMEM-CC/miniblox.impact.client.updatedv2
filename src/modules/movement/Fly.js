let flyvalue, flyvert, flybypass;
const fly = new Module("Fly", function(callback) {
    if (!callback) {
        if (player) {
            player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
            player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
        }
        delete tickLoop["Fly"];
        desync = false;
        return;
    }
    desync = true;
    tickLoop["Fly"] = function() {
        const dir = getMoveDirection(flyvalue[1]);
        player.motion.x = dir.x;
        player.motion.z = dir.z;
        player.motion.y = keyPressedDump("space") ? flyvert[1] : (keyPressedDump("shift") ? -flyvert[1] : 0);
    };
});
flybypass = fly.addoption("Bypass", Boolean, true);
flyvalue = fly.addoption("Speed", Number, 0.18);
flyvert = fly.addoption("Vertical", Number, 0.3);