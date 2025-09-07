/**
 * Timer Module
 */

// Timer module variables
let timervalue;

// Timer module implementation
const timer = new Module("Timer", function(callback) {
	// reloadTickLoop function moved inline to access runtime variables
	const value = callback ? 50 / timervalue[1] : 50;
	if (typeof game !== 'undefined' && game.tickLoop) {
		if (typeof MSPT !== 'undefined') MSPT = value;
		clearInterval(game.tickLoop);
		game.tickLoop = setInterval(() => game.fixedUpdate(), value);
	}
});
timervalue = timer.addoption("Value", Number, 1.2);
