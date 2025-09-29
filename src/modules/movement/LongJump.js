let ljpower, ljboost, ljdesync;
const longjump = new Module("LongJump", function(callback) {
    if (!callback) {
        delete tickLoop["LongJump"];
        desync = false;
        return;
    }

    desync = ljdesync[1];
    let jumping = false;
    let boostTicks = 0;

    tickLoop["LongJump"] = function() {
        if (!player) return;

        // Detect jump key
        if (keyPressedDump("space") && player.onGround && !jumping) {
            jumping = true;
            boostTicks = ljboost[1];
            player.motion.y = 0.42; // vanilla mc jump power lol
        }

        if (jumping) {
            const dir = getMoveDirection(ljpower[1]);
            player.motion.x = dir.x;
            player.motion.z = dir.z;

            boostTicks--;
            if (boostTicks <= 0 || player.onGround) {
                jumping = false;
            }
        }
    };
});

// Options
ljpower  = longjump.addoption("Power", Number, 0.6);   // horizontal boost
ljboost  = longjump.addoption("BoostTicks", Number, 10); // how long boost lasts
ljdesync = longjump.addoption("Desync", Boolean, true);  // toggle desync mode