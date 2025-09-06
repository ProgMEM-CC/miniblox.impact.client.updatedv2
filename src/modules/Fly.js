let flyvalue, flyvert, flybypass;
const fly = new Module("Fly", function(callback) {
	if (callback) {
		let ticks = 0;
		tickLoop["Fly"] = function() {
			ticks++;
			const dir = getMoveDirection(flyvalue[1]);
			player.motion.x = dir.x;
			player.motion.z = dir.z;
			player.motion.y = keyPressedDump("space") ? flyvert[1] : (keyPressedDump("shift") ? -flyvert[1] : 0);
		};
	}
	else {
		delete tickLoop["Fly"];
		if (player) {
			player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
			player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
		}
	}
});
flybypass = fly.addoption("Bypass", Boolean, true);
flyvalue = fly.addoption("Speed", Number, 2);
flyvert = fly.addoption("Vertical", Number, 0.7);