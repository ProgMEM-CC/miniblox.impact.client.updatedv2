// Streamer Mode Module
var streamerToggle, hideConsole, hideNameUI;

var streamerMode = new Module("StreamerMode", function (enabled) {
    if (enabled) {
        if (hideConsole[1]) {
            streamerMode._originalConsole = console.log;
            console.log = function () {}; // Silence logs
        }

        if (hideNameUI[1]) {
            if (window.player && window.player.name) {
                streamerMode._originalName = window.player.name;
                window.player.name = "Anonymous";
            }

            var nameTags = document.querySelectorAll(".username, .displayname, .player-name");
            for (var i = 0; i < nameTags.length; i++) {
                nameTags[i].textContent = "Anonymous";
            }
        }

        console.info("[StreamerMode] ENABLED");
    } else {
        if (hideConsole[1] && streamerMode._originalConsole) {
            console.log = streamerMode._originalConsole;
        }

        if (hideNameUI[1] && streamerMode._originalName) {
            if (window.player) {
                window.player.name = streamerMode._originalName;
            }

            var nameTags = document.querySelectorAll(".username, .displayname, .player-name");
            for (var i = 0; i < nameTags.length; i++) {
                nameTags[i].textContent = streamerMode._originalName;
            }
        }

        console.info("[StreamerMode] DISABLED");
    }
});

// 🧩 Options for StreamerMode
hideConsole = streamerMode.addoption("Hide Console Logs", Boolean, true);
hideNameUI = streamerMode.addoption("Hide Name in UI", Boolean, true);
