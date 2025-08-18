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
        "Vector",         // Owner
        "Tester",         // Admin
        "KanusMaximus",   // Admin
        "Qhyun",          // Admin
        "Notch", "Dream", "Steve", "Herobrine" // Classic filler
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

        ClientSocket.sendPacket(new SPacketMessage({
            text: name + " joined the game"
        }));
    }, 60000); // Every 60 seconds

    tickLoop["GhostJoin"] = function() {
        if (lastGhost) {
            game.chat.addChat({
                text: lastGhost + " left the game",
                color: "yellow"
            });

            ClientSocket.sendPacket(new SPacketMessage({
                text: lastGhost + " left the game"
            }));

            lastGhost = null;
        }
    };
});
