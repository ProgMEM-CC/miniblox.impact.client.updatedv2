// ==UserScript==
// @name         Impact For Miniblox
// @namespace    https://github.com/progmem-cc
// @version      9-FINAL2
// @description  The ultimate Miniblox hacked client which is built for total domination of all Miniblox servers with a fully dark-mode optimized modern GUI and high performance guaranteed.
// @author       7GrandDadPGN, ProgMEM-CC, TheM1ddleM1n, 6x68 (bab), dtkiller-jp
// @match        https://miniblox.io/*
// @match        https://miniblox.org/*
// @match        https://miniblox.online/*
// @match        https://bloxbattles.io/*
// @icon         https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/favicon.png
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/vav4inject.js
// @require      https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/unlocker.js
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/main/tampermonkey.user.js
// @downloadURL  https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/main/tampermonkey.user.js
// @license      AGPL-3.0-only
// ==/UserScript==

/**
 * Hey! All of Impact's focus right now is being devoted to working on something else: a new base, let me explain why we want this.
 * While the new base is *definitely* not ready for production use yet, we'd recommend looking at its progress every few weeks or so,
 * One day, Vape Rewrite will be complete enough for me to move over to GitHub so people actually see it.
 * This base is *20x* easier to make things in, because it isn't put all into one clustered file.
 * Check how long the vav4inject.js file is, it's not even Impact's fault. Impact forked a fork of a fork of Vape,
 * and original Vape itself is *REALLY LONG*, with barely any modules compared to even the most basic Minecraft client!
 * This is why we created the new "base"
 * (it's not meant to be a base, but people really will turn it into by uselessly forking it) client, Vape Rewrite.
 * We put issues and the code itself in this one repository on Codeberg (GitHub but not telling me to embrace AI or leave):
 * <https://codeberg.org/Miniblox/VapeRewrite>
 * Fun fact: Impact doesn't work on the Crazy Games site, but Vape Rewrite does.
 * Oh, and by the way, it has a ClickGUI... An obnoxious one (will fix in 2038!), since it is always displayed.
 * Vape doesn't, and Impact vibe coded an easily detectable one.
 * I'm going to cut the yap and leave it here.
 * (P.S. TheM1ddleM1n, make an account on Codeberg again and join us... Or we will wait for me to move it over to GitHub)
 */
