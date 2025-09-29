new Module("NoFall", function(callback) {
    if (!callback) {
        delete tickLoop["NoFall"];
        // only other module that uses desync right now is Fly.
        if (!fly.enabled) desync = false;
        return;
    }
    let shouldDesync = false;
    tickLoop["NoFall"] = function() {
        if (!desync && shouldDesync) desync = true;
        // this will force desync off even if fly is on, but I'm too lazy to make an entire priority system
        // or something just to fix the 0 uses of fly while you're on the ground
        else if (player.onGround && shouldDesync && desync) desync = false;
        shouldDesync = !player.onGround && player.motionY < -0.6 && player.fallDistance >= 2.5;
    };
});