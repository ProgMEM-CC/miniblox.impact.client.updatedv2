// ==UserScript==
// @name         Miniblox Custom UI
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Custom UI for Miniblox home screen with animated background
// @author       You
// @match        https://miniblox.io/*
// @match        https://*.miniblox.io/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Add custom CSS
    GM_addStyle(`
        /* Canvas for animated background */
        #animated-bg-canvas {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 1 !important;
            pointer-events: none !important;
        }

        /* Hide original background image */
        .css-rkihvp {
            display: none !important;
        }

        /* Logo positioned at top left */
        .css-1je8qb9 {
            position: fixed !important;
            top: 20px !important;
            left: 20px !important;
            width: 250px !important;
            z-index: 1000 !important;
        }

        /* Main container */
        .css-wc2kfx {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            z-index: 100 !important;
        }

        /* Button container positioned at bottom center */
        .css-1q5zbtn {
            position: fixed !important;
            bottom: -300px !important;
            left: 35% !important;
            transform: translateX(-50%) !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            width: auto !important;
            max-width: calc(100vw - 40px) !important;
            z-index: 100 !important;
            top: auto !important;
        }

        /* Button size adjustment */
        .css-32lhf4 {
            flex: 1 1 auto !important;
            min-width: 120px !important;
            max-width: 180px !important;
            transition: transform 0.3s ease !important;
        }

        /* Button hover animation (move up) */
        .css-32lhf4:hover:not(:disabled) {
            transform: translateY(-5px) !important;
        }

        /* Sign In button positioned at top right */
        .css-4585ph {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 1000 !important;
        }

        /* Play button positioned above other buttons, left side */
        .css-19hh5el {
            position: fixed !important;
            bottom: 150px !important;
            left: 12% !important;
            width: auto !important;
            margin: 0 !important;
            z-index: 100 !important;
            top: auto !important;
        }

        /* Play button style adjustment */
        .css-19hh5el button {
            min-width: 120px !important;
            padding: 10px 15px !important;
            font-size: 20px !important;
            transition: transform 0.3s ease !important;
        }

        /* Play button hover animation */
        .css-19hh5el button:hover {
            transform: translateY(-5px) !important;
        }

        /* Hide Discord button */
        .css-7kkhgi {
            display: none !important;
        }

        /* Hide banner */
        .css-cezbwm {
            display: none !important;
        }

        /* Footer positioned at bottom center */
        .css-1qvc8ly {
            position: fixed !important;
            bottom: 5px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0, 0, 0, 0.5) !important;
            padding: 5px 15px !important;
            border-radius: 5px !important;
            font-size: 11px !important;
            z-index: 1000 !important;
        }
    `);

    // Create animated background
    function createAnimatedBackground() {
        // Remove existing canvas if present
        const existingCanvas = document.getElementById('animated-bg-canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'animated-bg-canvas';

        // Insert as first child of body
        if (document.body.firstChild) {
            document.body.insertBefore(canvas, document.body.firstChild);
        } else {
            document.body.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        console.log('Background canvas created:', canvas.width, 'x', canvas.height);

        // Wave layers (multiple layers for depth, slow movement)
        const layers = [
            { y: 0.85, speed: 0.5, amplitude: 60, color: 'rgba(20, 40, 70, 0.9)', frequency: 0.003 },
            { y: 0.80, speed: 0.6, amplitude: 50, color: 'rgba(30, 60, 90, 0.8)', frequency: 0.004 },
            { y: 0.75, speed: 0.7, amplitude: 45, color: 'rgba(40, 80, 110, 0.7)', frequency: 0.005 },
            { y: 0.70, speed: 0.8, amplitude: 40, color: 'rgba(50, 100, 130, 0.6)', frequency: 0.006 },
            { y: 0.65, speed: 0.9, amplitude: 35, color: 'rgba(60, 120, 150, 0.5)', frequency: 0.007 }
        ];

        let time = 0;
        let animationId = null;
        let isAnimating = true;

        function drawWave(layer, offset) {
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);

            // Draw smoother waves
            for (let x = 0; x <= canvas.width; x += 2) {
                const y = canvas.height * layer.y +
                    Math.sin(x * layer.frequency + offset) * layer.amplitude +
                    Math.sin(x * layer.frequency * 0.5 + offset * 0.7) * layer.amplitude * 0.6 +
                    Math.cos(x * layer.frequency * 0.3 + offset * 0.4) * layer.amplitude * 0.3;
                ctx.lineTo(x, y);
            }

            ctx.lineTo(canvas.width, canvas.height);
            ctx.closePath();
            ctx.fillStyle = layer.color;
            ctx.fill();
        }

        function animate() {
            if (!isAnimating) return;

            // Gradient background (deeper colors)
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#1a2332');
            gradient.addColorStop(0.5, '#243447');
            gradient.addColorStop(1, '#0f1821');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw waves from back to front
            for (let i = layers.length - 1; i >= 0; i--) {
                drawWave(layers[i], time * layers[i].speed * 0.01);
            }

            time += 0.5;
            animationId = requestAnimationFrame(animate);
        }

        // Start animation
        requestAnimationFrame(animate);
        console.log('Background animation started - time:', time);

        // Handle resize
        const resizeHandler = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            console.log('Resized:', canvas.width, 'x', canvas.height);
        };
        window.addEventListener('resize', resizeHandler);

        // Return cleanup function
        return () => {
            isAnimating = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            window.removeEventListener('resize', resizeHandler);
            canvas.remove();
        };
    }

    // Background animation cleanup function
    let cleanupBackground = null;

    // Execute after DOM is loaded
    function init() {
        console.log('Miniblox Custom UI: Starting');

        // Cleanup existing background
        if (cleanupBackground) {
            cleanupBackground();
        }

        // Create animated background
        cleanupBackground = createAnimatedBackground();

        // Check again after a delay (after React rendering)
        setTimeout(() => {
            const canvas = document.getElementById('animated-bg-canvas');
            if (!canvas) {
                console.log('Canvas not found, recreating');
                cleanupBackground = createAnimatedBackground();
            } else {
                console.log('Canvas confirmed OK');
            }
        }, 1000);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Execute immediately if DOM is already loaded
        setTimeout(init, 100);
    }

    // Reinitialize on page transition
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (!document.getElementById('animated-bg-canvas')) {
                console.log('Canvas not found after load, recreating');
                init();
            }
        }, 500);
    });

})();
