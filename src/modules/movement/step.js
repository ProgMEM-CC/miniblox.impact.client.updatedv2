/**
 * Step Module
 */

const step = new Module("Step", function(callback) {
	if (callback) {
		tickLoop["Step"] = function() {
			if (stepheight && stepheight[1] > 0) {
				player.stepHeight = stepheight[1];
			}
		}
	} else {
		delete tickLoop["Step"];
		player.stepHeight = 0.6;
	}
});
stepheight = step.addoption("Height", Number, 2);
