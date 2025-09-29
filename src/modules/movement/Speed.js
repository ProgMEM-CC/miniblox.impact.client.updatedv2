let speedvalue, speedjump, speedauto;
const speed = new Module("Speed", function(callback) {
    if (callback) {
        let lastjump = 10;
        tickLoop["Speed"] = function() {
            lastjump++;
            const oldMotion = new Vector3$1(player.motion.x, 0, player.motion.z);
            const dir = getMoveDirection(Math.max(oldMotion.length(), speedvalue[1]));
            lastjump = player.onGround ? 0 : lastjump;
            player.motion.x = dir.x;
            player.motion.z = dir.z;
            player.motion.y = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space") ? speedjump[1] : player.motion.y;
        };
    }
    else delete tickLoop["Speed"];
});
speedvalue = speed.addoption("Speed", Number, 0.39);
speedjump = speed.addoption("JumpHeight", Number, 0.42);
speedauto = speed.addoption("AutoJump", Boolean, true);