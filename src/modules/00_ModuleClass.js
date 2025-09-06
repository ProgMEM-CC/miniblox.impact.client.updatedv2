class Module {
	constructor(name, func) {
		this.name = name;
		this.func = func;
		this.enabled = false;
		this.bind = "";
		this.options = {};
		modules[this.name] = this;
	}
	toggle() {
		this.enabled = !this.enabled;
		enabledModules[this.name] = this.enabled;
		this.func(this.enabled);
	}
	setbind(key, manual) {
		if (this.bind != "") delete keybindCallbacks[this.bind];
		this.bind = key;
		if (manual) game.chat.addChat({text: "Bound " + this.name + " to " + (key == "" ? "none" : key) + "!"});
		if (key == "") return;
		const module = this;
		keybindCallbacks[this.bind] = function(j) {
			if (Game.isActive()) {
				module.toggle();
				game.chat.addChat({
					text: module.name + (module.enabled ? " Enabled!" : " Disabled!"),
					color: module.enabled ? "lime" : "red"
				});
			}
		};
	}
	addoption(name, typee, defaultt) {
		this.options[name] = [typee, defaultt, name, defaultt];
		return this.options[name];
	}
}