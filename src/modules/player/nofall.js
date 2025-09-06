/**
 * NoFall Module
 */

new Module("NoFall", function(callback) {
	if (callback) {
		tickLoop["NoFall"] = function() {
			if (player.fallDistance > 3) {
				player.onGround = true;
			}
		}
	} else {
		delete tickLoop["NoFall"];
	}
});
