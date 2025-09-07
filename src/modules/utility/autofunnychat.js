/**
 * AutoFunnyChat Module
 */

let funnyMessages = [
    "Sent back to the lobby—don't trip on the way out!",
    "Was that your best? Miniblox says no.",
    "You dropped faster than my WiFi.",
    "Did you forget to equip skill today?",
    "That was a tutorial death, right?",
    "Tip: Dodging is allowed.",
    "Respawn and try again (maybe with both hands).",
    "Out-clicked, out-played, outta here.",
    "Next time, bring a helmet. And armor. And hope.",
    "Imagine losing in Miniblox... tragic.",
    "Your blocks? My blocks now.",
    "Are you sure you're not an NPC?",
    "Pro tip: The void is not a shortcut.",
    "Is your keyboard upside down?",
    "That scoreboard doesn't lie.",
    "Miniblox called—wants its win streak back.",
    "Did you lag, or just freeze from fear?",
    "Was that a speedrun to the void?",
    "GG! (It was mostly me though.)",
    "You just got Minibloxed!",
    "Don't blame the ping, blame the skill.",
    "You make AFK players look cracked.",
    "If you were any slower, you'd be a block.",
    "That was less of a fight, more of a donation.",
    "Did you forget which game you're playing?",
    "Keyboard check. Mouse check. Skill... missing.",
    "If losing was an achievement, you'd be top of the leaderboard.",
    "You respawn more than you blink.",
    "Hope you enjoy the respawn timer.",
    "Maybe try winning... just once?",
    "Did you just speedrun getting eliminated?",
    "Miniblox tip: Winning is allowed.",
    "You just made the highlight reel—of fails.",
    "The only thing lower than your HP was your chance to win.",
    "If you see this, you lost the 50/50. Badly.",
    "That performance was sponsored by gravity.",
    "Your only kill streak is in the practice lobby.",
    "You bring a whole new meaning to 'easy win.'",
    "That was faster than a Miniblox queue skip.",
    "You just gave me free stats.",
    "Did you drop your keyboard? Because your plays are a mess.",
    "I've seen bots with better aim.",
    "Are you playing with your monitor off?",
    "You just got outplayed by someone eating snacks IRL.",
    "Did your mouse disconnect?",
    "If you're reading this, you just lost a 1v1.",
    "Not even lag could save you.",
    "Skill issue detected. Please reinstall.",
    "Your respawn button must be tired.",
    "You fight like a Miniblox villager.",
    "Maybe try using both hands next time.",
    "Spectator mode looks good on you.",
    "I hope you brought a map, because you're lost.",
    "Knocked out like my WiFi on a stormy day.",
    "That combo was sponsored by gravity.",
    "I'd say GG, but that wasn't even close.",
    "Do you need a tutorial?",
    "Blink if you need help.",
    "You just got styled on.",
    "Don't worry, practice makes... well, you tried."
];

const AutoFunnyChat = new Module("AutoFunnyChat", function(callback) {
    if (!callback) {
        delete tickLoop["AutoFunnyChat"];
        if (window.__autoFunnyKillMsgListener) {
            if (ClientSocket.off) {
                ClientSocket.off("CPacketMessage", window.__autoFunnyKillMsgListener);
            }
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
