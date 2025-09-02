var GhostJoin = new Module("GhostJoin", function(callback) {
    if (!callback) {
        delete tickLoop["GhostJoin"];
        if (window.__ghostJoinLoop) {
            clearInterval(window.__ghostJoinLoop);
            window.__ghostJoinLoop = undefined;
        }
        return;
    }

    var fakeNames = [
        "(99) Vector",         // Owner
        "(99) Tester",         // Admin
        "(99) KanusMaximus",   // Admin
        "(99) Qhyun",          // Admin                // 3 devs and a owner for miniblox LOL
    ];
    var lastGhost = null;

    if (window.__ghostJoinLoop) {
        clearInterval(window.__ghostJoinLoop);
    }

    window.__ghostJoinLoop = setInterval(function() {
        var name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
        lastGhost = name;

        game.chat.addChat({
            text: name + " joined the game",
            color: "yellow"
        });
    }, 10000); // Every 10 seconds

    tickLoop["GhostJoin"] = function() {
        if (lastGhost) {
            game.chat.addChat({
                text: lastGhost + " left the game",
                color: "yellow"
            });

            lastGhost = null;
        }
    };
});
