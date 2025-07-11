
(function() {
    'use strict';
    const originaldetectionEnabled= window.detectionEnabled
    const originonclickatclick = window.autoClickerDectectOnClick;
    // Wait until the original script is loaded and the `detected` function is available
    const originalDetected = window.detected;

    // Override the detected function
    window.detected = function(m) {
    };
    window.autoClickerDectectOnClick = function(m){};
  
    window.detectionEnabled = 0
})();
