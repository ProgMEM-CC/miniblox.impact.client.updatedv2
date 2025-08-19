let jumpflyvalue, jumpflyvert, jumpFlyUpMotion, jumpFlyGlide;
			// JumpFly
			const jumpfly = new Module("JumpFly", function(callback) {
				if (callback) {
					let ticks = 0;
					tickLoop["JumpFly"] = function() {
						ticks++;
						const dir = getMoveDirection(jumpflyvalue[1]);
						player.motion.x = dir.x;
						player.motion.z = dir.z;
						const goUp = keyPressedDump("space");
						const goDown = keyPressedDump("shift");
						if (goUp || goDown) {
							player.motion.y = goUp ? jumpflyvert[1] : -jumpflyvert[1];
						} else {
							player.motion.y = (ticks < 18 && ticks % 6 < 4 ? jumpFlyUpMotion[1] : jumpFlyGlide[1]);
						}
					};
				}
				else {
					delete tickLoop["JumpFly"];
					if (player) {
						player.motion.x = Math.max(Math.min(player.motion.x, 0.3), -0.3);
						player.motion.z = Math.max(Math.min(player.motion.z, 0.3), -0.3);
					}
				}
			});
			jumpflyvalue = jumpfly.addoption("Speed", Number, 2);
			jumpFlyGlide = jumpfly.addoption("GlideValue", Number, -0.27);
			jumpFlyUpMotion = jumpfly.addoption("UpMotion", Number, 4);
			jumpflyvert = jumpfly.addoption("Vertical", Number, 0.27);
