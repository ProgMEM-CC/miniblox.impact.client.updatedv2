// Speed module
let speedvalue, speedjump, speedauto, speedbypass;

const speed = new Module("Speed", function(callback) {
	if (!callback) {
		delete tickLoop["Speed"];
		desync = false; // disable desync when off
		return;
	}

	desync = speedbypass[1]; // enable desync flag if bypass is on

	let lastjump = 10;
	tickLoop["Speed"] = function() {
		lastjump++;

		const oldMotion = new Vector3$1(player.motion.x, 0, player.motion.z);
		const dir = getMoveDirection(Math.max(oldMotion.length(), speedvalue[1]));
		lastjump = player.onGround ? 0 : lastjump;

		// Base motion
		player.motion.x = dir.x;
		player.motion.z = dir.z;

		// Auto-jump
		const doJump = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space");
		if (doJump) {
			player.jump();
			player.motion.y = player.onGround && dir.length() > 0 && speedauto[1] && !keyPressedDump("space")
				? speedjump[1]
				: player.motion.y;
		}
	};
}, "Movement", () => `V ${speedvalue[1]} J ${speedjump[1]} ${speedauto[1] ? "A" : "M"}`);

// Options
speedbypass = speed.addoption("Bypass", Boolean, true);
speedvalue = speed.addoption("Speed", Number, 0.3);
speedjump = speed.addoption("JumpHeight", Number, 0.3);
speedauto = speed.addoption("AutoJump", Boolean, true);