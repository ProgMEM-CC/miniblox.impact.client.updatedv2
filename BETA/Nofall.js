			let noFallExtraY;
			const NoFall = new Module("NoFall", function(callback) {
				if (callback) {
					tickLoop["NoFall"] = function() {
						// check if the player is falling and above a block
						// player.fallDistance = 0;
						const boundingBox = player.getEntityBoundingBox();
						const clone = boundingBox.min.clone();
						clone.y -= noFallExtraY[1];
						const block = rayTraceBlocks(boundingBox.min, clone, true, false, false, game.world);
						if (block) {
							sendY = player.pos.y + noFallExtraY[1];
						}
					}
				} else {
					delete tickLoop["NoFall"];
				}
			});
			noFallExtraY = NoFall.addoption("extraY", Number, .41);
