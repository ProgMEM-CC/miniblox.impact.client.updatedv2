// ==UserScript==
// @name         unverified! with ripples!
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Miniblox client
// @author       Wytlines, Andreypidd, Fizzy, Loqle, Heythereu, TheM1ddleM1n
// @icon         https://cdn.glitch.global/33d72df5-1609-416b-9b20-b2d6f6548081/Untitled%20image%20(1).jpeg?v=1734041345350
// @match        https://miniblox.io/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    const normalWatermark = document.createElement('div');
    normalWatermark.style.position = 'fixed';
    normalWatermark.style.top = '10px';
    normalWatermark.style.left = '10px';
    normalWatermark.style.zIndex = '9999';
    normalWatermark.style.fontFamily = 'Roboto Mono, monospace';
    normalWatermark.style.fontSize = '20px';
    normalWatermark.style.color = 'white';
    normalWatermark.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
    normalWatermark.style.pointerEvents = 'none';
    normalWatermark.innerHTML =
        '\n        <span>unverified</span>\n        <span style="color: red; font-size: 20px; margin-left: 5px; display: inline-block; transform: rotate(180deg);">&#10004;</span>\n    ';
    document.body.appendChild(normalWatermark);

    const moduleElements = document.createElement('div');
    moduleElements.style.position = 'fixed';
    moduleElements.style.top = '10px';
    moduleElements.style.left = '10px';
    moduleElements.style.zIndex = '9999';
    moduleElements.style.backgroundColor = '#1c1c1c';
    moduleElements.style.borderRadius = '8px';
    moduleElements.style.padding = '10px';
    moduleElements.style.width = '250px';
    moduleElements.style.display = 'none';

    const demoWatermark = document.createElement('div');
    demoWatermark.style.color = 'white';
    demoWatermark.style.fontFamily = 'Roboto Mono, monospace';
    demoWatermark.style.fontSize = '20px';
    demoWatermark.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
    demoWatermark.style.display = 'flex';
    demoWatermark.style.alignItems = 'center';
    demoWatermark.style.justifyContent = 'center';
    demoWatermark.innerHTML =
        '\n        <span>unverified</span>\n        <span style="color: red; font-size: 20px; margin-left: 5px; transform: rotate(180deg);">&#10004;</span>\n        <span style="color: white; font-size: 15px; margin-left: 5px;">Demo</span>\n    ';
    moduleElements.appendChild(demoWatermark);

    let cpsDisplay, fpsDisplay, cps = 0, totalClicks = 0, cpsToDisplay = 0, prevCPS = 0, cpsCounterInterval, fps = 0, lastEndTimestamp = performance.now(), font = document.body.style.fontFamily;
    let cpsHistory = [], historyLength = 1000000;

    function displayCPSCounter() {
        cpsDisplay = document.createElement('div');
        cpsDisplay.className = 'cps-display';
        cpsDisplay.style.position = 'fixed';
        cpsDisplay.style.bottom = '10px';
        cpsDisplay.style.right = '10px';
        cpsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        cpsDisplay.style.color = 'white';
        cpsDisplay.style.padding = '10px';
        cpsDisplay.style.borderRadius = '4px';
        cpsDisplay.style.fontFamily = 'Roboto Mono, monospace';
        cpsDisplay.style.zIndex = '10000';
        cpsDisplay.style.width = '100px';
        cpsDisplay.style.height = '40px';
        cpsDisplay.style.cursor = 'move';
        document.body.appendChild(cpsDisplay);
        makeDraggable(cpsDisplay);
    }

    function updateCPSLabel() {
        if (cpsDisplay) {
            if (cpsToDisplay < prevCPS) {
                cpsToDisplay++;
            } else {
                cpsToDisplay > prevCPS && cpsToDisplay--;
            }
            cpsDisplay.innerText = 'CPS: ' + cpsToDisplay + ' | Avg: ' + calculateAverageCPS() + ' | Total: ' + totalClicks;
            cpsToDisplay !== prevCPS && requestAnimationFrame(updateCPSLabel);
        }
    }

    function calculateAverageCPS() {
        const total = cpsHistory.reduce((sum, value) => sum + value, 0);
        return (total / cpsHistory.length).toFixed(2); // Return average with 2 decimal places
    }

    function cpsCounterOnLoad() {
        cps = 0;
        prevCPS = 0;
        document.addEventListener('click', updateCPS);
        cpsCounterInterval = setInterval(() => {
            prevCPS = cps;
            cpsHistory.push(cps);
            if (cpsHistory.length > historyLength) {
                cpsHistory.shift(); // Remove the oldest entry
            }
            totalClicks++;
            cps = 0;
            updateCPSLabel();
        }, 1000);
    }

    function onModDisable() {
        document.removeEventListener('click', updateCPS);
        clearInterval(cpsCounterInterval);
        cpsDisplay && (cpsDisplay.remove(), (cpsDisplay = null));
    }

    function updateCPS() {
        cps++;
        createRippleEffect(event.clientX, event.clientY); // Create ripple effect on click
    }

    function createRippleEffect(x, y) {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 0, 0, 0.5)';
        ripple.style.width = '30px';
        ripple.style.height = '30px';
        ripple.style.left = `${x - 15}px`;
        ripple.style.top = `${y - 15}px`;
        ripple.style.pointerEvents = 'none';
        ripple.style.transition = 'transform 0.6s, opacity 0.6s';
        document.body.appendChild(ripple);

        setTimeout(() => {
            ripple.style.transform = 'scale(3)';
            ripple.style.opacity = '0';
        }, 0);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    function displayFPS() {
        fpsDisplay = document.createElement('div');
        fpsDisplay.className = 'fps-display';
        fpsDisplay.style.position = 'fixed';
        fpsDisplay.style.bottom = '60px';
        fpsDisplay.style.right = '10px';
        fpsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        fpsDisplay.style.color = 'white';
        fpsDisplay.style.padding = '10px';
        fpsDisplay.style.borderRadius = '4px';
        fpsDisplay.style.fontFamily = 'Roboto Mono, monospace';
        fpsDisplay.style.zIndex = '10000';
        fpsDisplay.style.width = '100px';
        fpsDisplay.style.height = '40px';
        fpsDisplay.style.cursor = 'move';
        document.body.appendChild(fpsDisplay);
        makeDraggable(fpsDisplay);
    }

    function updateFPS(prevEndTimestamp) {
        fps++;
        const updateDelay = prevEndTimestamp - lastEndTimestamp;
        updateDelay >= 1000 &&
            (fpsDisplay &&
                fpsDisplay.style.display !== 'none' &&
                (fpsDisplay.innerText = 'FPS: ' + fps),
            (fps = 0),
            (lastEndTimestamp = prevEndTimestamp));
        requestAnimationFrame(updateFPS);
    }

    function addFPSAnimationFrame() {
        requestAnimationFrame(updateFPS);
    }

    function makeDraggable(element) {
        let xDiff, yDiff;
        element.addEventListener('mousedown', (event) => {
            xDiff = event.clientX - element.getBoundingClientRect().left;
            yDiff = event.clientY - element.getBoundingClientRect().top;
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        });
        function mouseMove(event) {
            element.style.left = event.clientX - xDiff + 'px';
            element.style.top = event.clientY - yDiff + 'px';
            saveDisplayPosition(element); // Save position on drag
        }
        function mouseUp() {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
        }
    }

    function saveDisplayPosition(element) {
        const left = element.style.left;
        const top = element.style.top;
        localStorage.setItem(`${element.className}-left`, left);
        localStorage.setItem(`${element.className}-top`, top);
    }

    function loadDisplayPosition(element) {
        const left = localStorage.getItem(`${element.className}-left`);
        const top = localStorage.getItem(`${element.className}-top`);
        if (left) element.style.left = left;
        if (top) element.style.top = top;
    }

    const modules = [
        {
            name: 'Keystrokes',
            settings: [],
            active: false,
        },
        {
            name: 'CPS Counter',
            settings: [],
            active: false,
        },
        {
            name: 'FPS Display',
            settings: [],
            active: false,
        },
        {
            name: 'FPS Boost',
            settings: [],
            active: false,
        },
        {
            name: 'Font Change',
            settings: [],
            active: false,
        },
    ];

    function saveSettings() {
        const settings = modules.reduce((i, module) => {
            return (i[module.name] = module.active), i;
        }, {});
        localStorage.setItem('modulesSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const settingsJson = JSON.parse(localStorage.getItem('modulesSettings'));
        settingsJson &&
            modules.forEach((module) => {
                module.active = settingsJson[module.name] || false;
                if (module.active) {
                    document.querySelector(
                        '.module[data-name="' + module.name + '"] input'
                    ).checked = true;
                    if (module.name === 'CPS Counter') {
                        displayCPSCounter();
                        cpsCounterOnLoad();
                    } else {
                        if (module.name === 'FPS Display') {
                            displayFPS();
                            fpsDisplay.style.display = 'block';
                        } else {
                            if (module.name === 'Font Change') {
                                document.body.style.fontFamily = 'Roboto Mono, monospace';
                            } else {
                                module.name === 'Keystrokes' &&
                                    (keystrokesDisplay.style.display = 'block');
                            }
                        }
                    }
                }
            });
    }

    modules.forEach((mod) => {
        const el = document.createElement('div');
        el.className = 'module';
        el.draggable = true;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'space-between';
        el.style.padding = '10px';
        el.style.marginBottom = '10px';
        el.style.backgroundColor = '#2a2a2a';
        el.style.borderRadius = '4px';
        el.style.position = 'relative';
        el.dataset.name = mod.name;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'module-name';
        nameSpan.style.color = 'white';
        nameSpan.style.fontFamily = 'Roboto Mono, monospace';
        nameSpan.innerText = mod.name;
        const activeIndicator = document.createElement('div');
        activeIndicator.className = 'active-indicator';
        activeIndicator.style.width = '10px';
        activeIndicator.style.height = '10px';
        activeIndicator.style.borderRadius = '50%';
        activeIndicator.style.backgroundColor = 'transparent';
        activeIndicator.style.marginRight = '5px';
        el.appendChild(nameSpan);
        el.appendChild(activeIndicator);
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'switch';
        toggleLabel.style.position = 'relative';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'toggle';
        toggleLabel.appendChild(toggle);
        const sliderSpan = document.createElement('span');
        sliderSpan.className = 'slider';
        toggleLabel.appendChild(sliderSpan);
        el.appendChild(toggleLabel);
        moduleElements.appendChild(el);
        toggle.addEventListener('change', () => {
            activeIndicator.style.backgroundColor = toggle.checked
                ? 'transparent'
                : 'transparent';
            mod.active = toggle.checked;
            saveSettings();
            if (mod.name === 'CPS Counter') {
                mod.active ? (displayCPSCounter(), cpsCounterOnLoad()) : onModDisable();
            } else {
                if (mod.name === 'FPS Display') {
                    mod.active
                        ? (displayFPS(), (fpsDisplay.style.display = 'block'))
                        : (fpsDisplay.style.display = 'none');
                } else {
                    if (mod.name === 'Font Change') {
                        mod.active
                            ? (document.body.style.fontFamily = 'Roboto Mono, monospace')
                            : (document.body.style.fontFamily = font);
                    } else {
                        mod.name === 'Keystrokes' &&
                            (mod.active
                                ? (keystrokesDisplay.style.display = 'block')
                                : (keystrokesDisplay.style.display = 'none'));
                    }
                }
            }
        });
    });

    document.body.appendChild(moduleElements);
    const css = document.createElement('style');
    css.textContent =
        '\n        .switch {\n            position: relative;\n            display: inline-block;\n            width: 34px;\n            height: 20px;\n            transition: transform 0.2s;\n        }\n        .switch:hover {\n            transform: scale(1.1);\n        }\n        .switch input {\n            opacity: 0;\n            width: 0;\n            height: 0;\n        }\n        .slider {\n            position: absolute;\n            cursor: pointer;\n            top: 0;\n            left: 0;\n            right: 0;\n            bottom: 0;\n            background-color: #ccc;\n            border-radius: 34px;\n            transition: .4s;\n        }\n        .slider:before {\n            position: absolute;\n            content: "";\n            height: 16px;\n            width: 16px;\n            left: 2px;\n            bottom: 2px;\n            background-color: white;\n            border-radius: 50%;\n            transition: .4s;\n        }\n        input:checked + .slider {\n            background-color: #28a745;\n        }\n        input:checked + .slider:before {\n            transform: translateX(14px);\n        }\n        .module {\n            transition: transform 0.2s, background-color 0.2s;\n        }\n        .module:hover {\n            transform: scale(1.02);\n            background-color: #3c3c3c;\n        }\n        .fps-display,\n        .cps-display {\n            position: fixed;\n            background-color: rgba(0, 0, 0, 0.8);\n            color: white;\n            padding: 5px;\n            border-radius: 4px;\n            font-family: \'Roboto Mono\', monospace;\n            z-index: 10000;\n        }\n    ';
    document.head.appendChild(css);

    document.addEventListener('keydown', (e) => {
        const isInputOrTextArea =
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA';
        !isInputOrTextArea &&
            e.key === 'l' &&
            (moduleElements.style.display =
                moduleElements.style.display === 'none' ? 'block' : 'none');

        // Keyboard shortcuts for toggling features
        if (e.code === 'KeyC') {
            const cpsToggle = modules.find(mod => mod.name === 'CPS Counter');
            cpsToggle.active = !cpsToggle.active;
            saveSettings();
            cpsToggle.active ? displayCPSCounter() : onModDisable();
        }
        if (e.code === 'KeyF') {
            const fpsToggle = modules.find(mod => mod.name === 'FPS Display');
            fpsToggle.active = !fpsToggle.active;
            saveSettings();
            fpsToggle.active ? displayFPS() : (fpsDisplay.style.display = 'none');
        }
    });

    const keystrokesDisplay = document.createElement('div');
    keystrokesDisplay.style.display = 'none';
    keystrokesDisplay.style.zIndex = '10000';
    keystrokesDisplay.style.width = '300px';
    keystrokesDisplay.style.height = '200px';
    keystrokesDisplay.style.transform = 'translate(-50%, -50%)';
    keystrokesDisplay.style.position = 'fixed';
    keystrokesDisplay.style.left = GM_getValue('left') ? GM_getValue('left') + 'px' : '50%';
    keystrokesDisplay.style.top = GM_getValue('top') ? GM_getValue('top') + 'px' : '50%';
    keystrokesDisplay.style.opacity = '100%';
    keystrokesDisplay.style.boxShadow = 'none';
    keystrokesDisplay.style.backgroundColor = 'transparent';
    window.addEventListener('load', () => document.body.appendChild(keystrokesDisplay));

    let mouseDownOnNonInputElement = false;
    keystrokesDisplay.addEventListener('mousedown', (e) => {
        e.target.nodeName !== 'INPUT' && (mouseDownOnNonInputElement = true);
    });
    document.addEventListener('mousemove', (e) => {
        if (mouseDownOnNonInputElement) {
            const clientX = e.clientX,
                clientY = e.clientY;
            keystrokesDisplay.style.left = clientX + 'px';
            keystrokesDisplay.style.top = clientY + 'px';
            GM_setValue('left', clientX);
            GM_setValue('top', clientY);
        }
    });
    document.addEventListener('mouseup', () => {
        mouseDownOnNonInputElement = false;
    });

    const createKeystrokesElement = (text, top, left) => {
        const createdDiv = document.createElement('div');
        return (
            (createdDiv.style.position = 'fixed'),
            (createdDiv.style.color = '#ffffff'),
            (createdDiv.textContent = text),
            (createdDiv.style.top = top),
            (createdDiv.style.left = left),
            (createdDiv.style.transform = 'translateX(-50%)'),
            (createdDiv.style.zIndex = '10000'),
            (createdDiv.style.fontWeight = 'bold'),
            (createdDiv.style.borderRadius = '0'),
            (createdDiv.style.backgroundColor = 'rgba(128, 128, 128, 0.7)'),
            (createdDiv.style.border = '3px solid #333333'),
            (createdDiv.style.fontSize = '24px'),
            (createdDiv.style.height = '50px'),
            (createdDiv.style.width = '50px'),
            (createdDiv.style.textAlign = 'center'),
            (createdDiv.style.lineHeight = '50px'),
            (createdDiv.style.fontFamily = 'Roboto Mono, monospace'),
            createdDiv
        );
    },
    wKey = createKeystrokesElement('W', '5px', '50%'),
    sKey = createKeystrokesElement('S', '60px', '50%'),
    aKey = createKeystrokesElement('A', '60px', '31.5%'),
    dKey = createKeystrokesElement('D', '60px', '68%'),
    lmbKeystroke = document.createElement('div');
    lmbKeystroke.style.position = 'fixed';
    lmbKeystroke.style.color = '#ffffff';
    lmbKeystroke.textContent = 'LMB';
    lmbKeystroke.style.top = '115px';
    lmbKeystroke.style.left = '23%';
    lmbKeystroke.style.width = '79px';
    lmbKeystroke.style.zIndex = '10000';
    lmbKeystroke.style.fontWeight = 'bold';
    lmbKeystroke.style.borderRadius = '0';
    lmbKeystroke.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
    lmbKeystroke.style.border = '3px solid #333333';
    lmbKeystroke.style.fontSize = '18px';
    lmbKeystroke.style.height = '50px';
    lmbKeystroke.style.textAlign = 'center';
    lmbKeystroke.style.lineHeight = '50px';
    lmbKeystroke.style.fontFamily = 'Roboto Mono, monospace';
    const rmbKeystroke = document.createElement('div');
    rmbKeystroke.style.position = 'fixed';
    rmbKeystroke.style.color = '#ffffff';
    rmbKeystroke.textContent = 'RMB';
    rmbKeystroke.style.top = '115px';
    rmbKeystroke.style.left = '50%';
    rmbKeystroke.style.width = '79px';
    rmbKeystroke.style.zIndex = '10000';
    rmbKeystroke.style.fontWeight = 'bold';
    rmbKeystroke.style.borderRadius = '0';
    rmbKeystroke.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
    rmbKeystroke.style.border = '3px solid #333333';
    rmbKeystroke.style.fontSize = '18px';
    rmbKeystroke.style.height = '50px';
    rmbKeystroke.style.textAlign = 'center';
    rmbKeystroke.style.lineHeight = '50px';
    rmbKeystroke.style.fontFamily = 'Roboto Mono, monospace';
    const spacebarKeyElement = document.createElement('div');
    spacebarKeyElement.style.position = 'fixed';
    spacebarKeyElement.style.color = '#ffffff';
    spacebarKeyElement.textContent = '_____';
    spacebarKeyElement.style.top = '170px';
    spacebarKeyElement.style.left = '50%';
    spacebarKeyElement.style.transform = 'translateX(-50%)';
    spacebarKeyElement.style.zIndex = '10000';
    spacebarKeyElement.style.fontWeight = 'bold';
    spacebarKeyElement.style.borderRadius = '0';
    spacebarKeyElement.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
    spacebarKeyElement.style.border = '3px solid #333333';
    spacebarKeyElement.style.fontSize = '18px';
    spacebarKeyElement.style.height = '50px';
    spacebarKeyElement.style.width = '160px';
    spacebarKeyElement.style.textAlign = 'center';
    spacebarKeyElement.style.lineHeight = '50px';
    spacebarKeyElement.style.fontFamily = 'Roboto Mono, monospace';
    keystrokesDisplay.appendChild(wKey);
    keystrokesDisplay.appendChild(sKey);
    keystrokesDisplay.appendChild(aKey);
    keystrokesDisplay.appendChild(dKey);
    keystrokesDisplay.appendChild(lmbKeystroke);
    keystrokesDisplay.appendChild(rmbKeystroke);
    keystrokesDisplay.appendChild(spacebarKeyElement);
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyW') {
            wKey.style.backgroundColor = '#8B0000';
        } else {
            if (event.code === 'KeyS') {
                sKey.style.backgroundColor = '#8B0000';
            } else {
                if (event.code === 'KeyA') {
                    aKey.style.backgroundColor = '#8B0000';
                } else {
                    if (event.code === 'KeyD') {
                        dKey.style.backgroundColor = '#8B0000';
                    } else {
                        event.code === 'Space' &&
                            (spacebarKeyElement.style.backgroundColor = '#8B0000');
                    }
                }
            }
        }
    });
    document.addEventListener('keyup', (event) => {
        if (event.code === 'KeyW') {
            wKey.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
        } else {
            if (event.code === 'KeyS') {
                sKey.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
            } else {
                if (event.code === 'KeyA') {
                    aKey.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
                } else {
                    if (event.code === 'KeyD') {
                        dKey.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
                    } else {
                        event.code === 'Space' &&
                            (spacebarKeyElement.style.backgroundColor = 'rgba(128, 128, 128, 0.7)');
                    }
                }
            }
        }
    });
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
            lmbKeystroke.style.backgroundColor = '#8B0000';
        } else {
            event.button === 2 && (rmbKeystroke.style.backgroundColor = '#8B0000');
        }
    });
    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            lmbKeystroke.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
        } else {
            event.button === 2 &&
                (rmbKeystroke.style.backgroundColor = 'rgba(128, 128, 128, 0.7)');
        }
    });

    loadSettings();
    addFPSAnimationFrame();
})();
