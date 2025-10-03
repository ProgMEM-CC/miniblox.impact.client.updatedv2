let funnyMessages = [
    "Prediction ACs: great at guessing wrong.",
    "Lag spikes? Blame the AC trying to play psychic.",
    "Jesus walked on water. ACs still trip over puddles.",
    "Walking on air? ACs call it a glitch. We call it precision.",
    "Prediction ACs eat packets 4 breakfast. Too bad they choke on velocity.",
    "Gravity’s a suggestion. ACs treat it like gospel.",
    "Scaffold smoother than your AC’s excuses.",
    "Tick-perfect bridging. ACs still counting frames.",
    "Snapped into water? ACs thought you were a fish.",
    "Water-walking? ACs still learning to swim.",
    "Falling? Nah. Just descending with style while ACs panic.",
    "Patch notes say 'fixed.' Reality says 'still broken.'",
    "Bypass? No. ACs just forgot how to detect.",
    "Modules adapt. ACs react — poorly.",
    "Silent movement. Loud AC confusion.",
    "Prediction? Velocity? ACs still buffering.",
    "No permission asked. ACs weren’t invited.",
    "Every module is a flex. ACs just fold.",
    "No config needed. ACs still reading the manual.",
    "Toggle. Deliver. ACs scramble.",
    "ACs don’t detect. They guess and hope.",
    "Unleashed. ACs unleashed their incompetence.",
    "No drama. Just full domination over servers.",
    "ACs getting patched? We evolve.",
    "Cheating? No. Just outperforming your AC’s imagination.",
    "Toggle scaffold. Build legacy. ACs build logs no one reads.",
    "Flinch? ACs do. We don’t.",
    "Modules = superpowers. ACs = kryptonite to themselves.",
    "ACs call it daddy. We call it Tuesday.",
    "Still undetected. Still undefeated. ACs still confused.",
    "Toggle one module. Server cries. ACs sob.",
    "Patch notes scared. ACs terrified.",
    "Your client warned you. ACs didn’t listen.",
    "Smooth as silk. ACs still stuck in sandpaper mode.",
    "Stealth so clean, ACs think it's a ghost."
];

const AutoFunnyChat = new Module("AutoFunnyChat", function(callback) {
    if (!callback) {
        delete tickLoop["AutoFunnyChat"];
        if (window.__autoFunnyKillMsgListener) {
            ClientSocket.off && ClientSocket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
            window.__autoFunnyKillMsgListener = undefined;
        }
        return;
    }
    // Periodic random funny message
    let lastSent = 0;
    tickLoop["AutoFunnyChat"] = function() {
        if (Date.now() - lastSent > 40000) { // Sends every 40 seconds
            const msg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
            ClientSocket.sendPacket(new SPacketMessage({text: msg}));
            lastSent = Date.now();
        }
    };

    // Also send on kill events (Miniblox chat detection)
    if (!window.__autoFunnyKillMsgListener) {
        window.__autoFunnyKillMsgListener = function(h) {
            if (
                h.text &&
                (
                    h.text.includes("You eliminated") ||
                    h.text.includes("You knocked out") ||
                    h.text.includes("You sent") ||
                    (h.text.includes("eliminated by") && h.text.includes(player.name)) ||
                    h.text.includes(player.name + " eliminated")
                )
            ) {
                const msg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
                setTimeout(function() {
                    ClientSocket.sendPacket(new SPacketMessage({text: msg}));
                }, 500 + Math.random() * 1000); // slight delay for realism
            }
        };
        ClientSocket.on("CPacketMessage", window.__autoFunnyKillMsgListener);
    }
});