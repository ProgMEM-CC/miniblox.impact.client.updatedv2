var GhostJoin = new Module("GhostJoin", function(callback) {
    if (!callback) {
        delete tickLoop["GhostJoin"];
        if (window.__ghostJoinLoop) {
            clearTimeout(window.__ghostJoinLoop);
            window.__ghostJoinLoop = undefined;
        }
        return;
    }

    var fakeNames = [
        "Vector", "Tester", "KanusMaximus", "Qhyun",
        "Notch", "Dream", "Steve", "Herobrine"         // 4 Minecraft devs v 4 Miniblox devs LOL
    ];
    var lastGhost = null;

    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function spawnGhost() {
        var name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
        lastGhost = name;
        var joinText = "[Ghost] " + name + " joined the game";

        // Inject ghost message directly
        ClientSocket.sendPacket(new SPacketMessage({ text: joinText }));
        game.chat.addChat({ text: joinText, color: "yellow", extra: [] });

        window.__ghostJoinLoop = setTimeout(function() {
            if (lastGhost) {
                var leaveText = "[Ghost] " + lastGhost + " left the game";
                ClientSocket.sendPacket(new SPacketMessage({ text: leaveText }));
                game.chat.addChat({ text: leaveText, color: "yellow", extra: [] });
                lastGhost = null;
            }

            window.__ghostJoinLoop = setTimeout(spawnGhost, getRandomDelay(5000, 15000));
        }, getRandomDelay(5000, 15000));
    }

    spawnGhost();
});
