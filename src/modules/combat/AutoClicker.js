let clickDelay = Date.now();
new Module("AutoClicker", function(callback) {
    if (callback) {
        tickLoop["AutoClicker"] = function() {
            if (clickDelay < Date.now() && playerControllerDump.key.leftClick && !player.isUsingItem()) {
                playerControllerDump.leftClick();
                clickDelay = Date.now() + 60;
            }
        }
    } else delete tickLoop["AutoClicker"];
});