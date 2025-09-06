function reloadTickLoop(value) {
	if (game.tickLoop) {
		MSPT = value;
		clearInterval(game.tickLoop);
		game.tickLoop = setInterval(() => game.fixedUpdate(), MSPT);
	}
}