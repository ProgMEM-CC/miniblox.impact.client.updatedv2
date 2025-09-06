/**
 * FastBreak Module
 */

new Module("FastBreak", function(callback) {
	if (callback) {
		tickLoop["FastBreak"] = function() {
			if (breakStart + 100 < Date.now()) {
				breakStart = Date.now() + 1000;
			}
		}
	} else {
		delete tickLoop["FastBreak"];
	}
});
