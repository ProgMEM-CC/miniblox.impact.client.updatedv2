new Module("NoFall", function(callback) {
	if (callback) {
		let ticks = 0;
		tickLoop["NoFall"] = function() {
    		const ray = rayTraceBlocks(player.getEyePos(), player.getEyePos().clone().setY(0), false, false, false, game.world);
			if (player.fallDistance > 2.5 && ray) {
				ClientSocket.sendPacket(new SPacketPlayerPosLook({pos: {x: player.pos.x, y: ray.hitVec.y, z: player.pos.z}, onGround: true}));
				player.fallDistance = 0;
			}
		};
	}
	else delete tickLoop["NoFall"];
});