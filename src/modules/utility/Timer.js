let timervalue;
const timer = new Module("Timer", function(callback) {
    reloadTickLoop(callback ? 50 / timervalue[1] : 50);
});
timervalue = timer.addoption("Value", Number, 1.2);