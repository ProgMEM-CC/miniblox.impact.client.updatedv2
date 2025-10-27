// A Simple test script - dtkiller-jp
new Module("TestScript", function (enabled) {
    if (enabled) {
        console.log("TestScript has been enabled!");
        tickLoop["TestScript"] = function () {
            console.log("TestScript tickLoop")
        };
    } else {
        console.log("TestScript has been disabled!");
        delete tickLoop["TestScript"];
    }
});
