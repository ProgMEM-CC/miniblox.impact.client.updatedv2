let disablerPacketInterval, disablerStartTime;
const disabler = new Module("Disabler", function(callback) {
    if (callback) {
        disablerStartTime = Date.now();
        let originalSendPacket = ClientSocket.sendPacket;
        ClientSocket.sendPacket = function(packet) {
            if (Date.now() - disablerStartTime < 1500 && packet instanceof SPacketPlayerPosLook) {
                let transactionId = Math.floor(Math.random() * 65535);
                ClientSocket.sendPacket(new SPacketConfirmTransaction({
                    windowId: 0,
                    action: transactionId,
                    accepted: true
                }));
                return;
            }
            originalSendPacket.apply(ClientSocket, [packet]);
        };
        tickLoop["Disabler"] = function() {
            if (!player || !game.world || Date.now() - disablerStartTime > 1500) return;
            if (Date.now() % disablerPacketInterval[1] < 5) {
                let transactionId = Math.floor(Math.random() * 65535);
                ClientSocket.sendPacket(new SPacketConfirmTransaction({
                    windowId: 0,
                    action: transactionId,
                    accepted: true
                }));
            }
        };
    } else {
        delete tickLoop["Disabler"];
        ClientSocket.sendPacket = ClientSocket.sendPacket.original || ClientSocket.sendPacket;
        disablerStartTime = 0;
    }
});
disablerPacketInterval = disabler.addoption("PacketInterval", Number, 50, [20, 100, 5]);
disablerStartTime = disabler.addoption("StartTime", Number, 0);
