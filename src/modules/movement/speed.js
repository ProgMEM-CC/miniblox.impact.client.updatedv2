/**
 * Speed Module
 */

new Module("Speed", function(callback) {
	if (callback) {
		tickLoop["Speed"] = function() {
			if (player.onGround && (player.moveStrafeDump || player.moveForwardDump)) {
				player.motionX *= 1.5;
				player.motionZ *= 1.5;
			}
		}
	} else {
		delete tickLoop["Speed"];
	}
});
