// Simple test script
new Module("TestScript", function (enabled) {
    if (enabled) {
        console.log("TestScript enabled!");
        tickLoop["TestScript"] = function () {
            console.log("TestScript tickLoop")
        };
    } else {
        console.log("TestScript disabled!");
        delete tickLoop["TestScript"];
    }
});
