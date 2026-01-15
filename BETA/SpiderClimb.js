const spiderclimb = new Module("SpiderClimb", function(callback) {
    if (!callback) {
        delete tickLoop["SpiderClimb"];
        return;
    }

    tickLoop["SpiderClimb"] = function() {
        if (!player || !player.pos || !game.world) return;

        const pos = new BlockPos(player.pos.x, player.pos.y, player.pos.z);
        const sides = [EnumFacing.NORTH, EnumFacing.SOUTH, EnumFacing.EAST, EnumFacing.WEST];

        for (const side of sides) {
            const blockState = game.world.getBlockState(pos.offset(side));
            const block = blockState.getBlock();
            const isClingable = block.material !== Materials.air && !block.isTransparent;

            const sneakRequired = spiderclimb.options["Enable Sneak Climb"][1];
            const allowAir = spiderclimb.options["Allow Air Cling"][1];
            const climbSpeed = spiderclimb.options["Climb Speed"][1];

            const isSneaking = sneakRequired ? keyPressedDump("shift") : true;
            const nearWall = isClingable && (allowAir || player.onGround);
            const verticalMotionSafe = player.motion.y <= 0.05;

            if (nearWall && isSneaking && verticalMotionSafe) {
                player.motion.y = climbSpeed;
                player.onGround = true;
                break;
            }
        }
    };
});

spiderclimb.addoption("Cling Height", Number, 1.1);
spiderclimb.addoption("Enable Sneak Climb", Boolean, true);
spiderclimb.addoption("Allow Air Cling", Boolean, true);
spiderclimb.addoption("Climb Speed", Number, 0.32);
