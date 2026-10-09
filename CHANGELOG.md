# Changelog

**Archived** changelogs for this client. It's now discontinued, so I'm not adding anything new.
Want a good client that **will probably soon support console injection**, **works on the latest version**, and **has a MaceKill + NoFall that doesn't make the mace useless**?
Check out [Vape Rewrite]!

## v10-UNPATCHED1 (migrate/unpatch branch)

- Migrated off code replacement-based injection (string-patching `assets/index-*.js`, which Vector broke via chunk splitting + top-level symbol minification) to export scanning + runtime hooks, following [VapeRewrite's fix/unpatch](https://codeberg.org/Miniblox/VapeRewrite/pulls/37):
  - Bundle source is only fetched to run (read-only) dump regexes; the reference dump patterns are used (verified against the live bundle — only the unused `isConverting` fails to match).
  - Game refs (`ClientSocket`, `game`/`player`/`world`, `Items`, packets, three.js, …) come from `import(script.src)` + shape scanning, with React-fiber/`unsafeWindow` fallbacks for chunk-split pieces.
  - The reference remap proxy maps readable names to minified fields (`Mappings` + `aliasRemap`, so legacy `*Dump` names keep working).
  - Ticks/packets/connect/render go through an event bus + method proxies instead of inline patches (Killaura, Velocity, Sprint, Step, ESP, TextGUI overlay, commands, login bypass, desync/silent-yaw, …).
  - Cannot-be-proxied inline patches are documented TODOs, same as upstream: Phase X/Y/Z collision scaling, 1.7 viewmodel animation, swing-cancel check, server-correction removal.
  - No `eval` of game/cheat code anymore: the migrated bodies are plain inlined code (the only remaining `eval` is the pre-existing custom user-script loader).
  - `.report` uses a prompt + GitHub link instead of the old modal; `.chat`/commands no longer lowercase message bodies.

## v9-FINAL4 (2026-06-14)

Another update, just updated to the latest version. Can't go to sleep without Vector updating for the 30th time to break some clients.

## v9-FINAL3 (2026-06-11)

A very small update. I haven't actually tested it, but it should work since it was just 2 variable name changes to fix 2 modules.
DM me on Matrix (@opsec.one), Signal (@opsec.02), or Discord (@opsec.one)
if something doesn't work because of the update and isn't anticheat related (I don't update Impact other than for keeping it working whenever it breaks)

- Fixed Sprint and NoSlowdown breaking due to the game updating variable names used in their replacements.

## v9-FINAL2 (2026-02-02)

- Switched to ProgMEM-CC's IMChat deployment since mine is now dead due to my usage limits being exceeded (mainly because vercel doesn't like SSE for whatever reason)

<img width="404" height="415" alt="image" src="https://github.com/user-attachments/assets/842a00a1-d612-4b01-9cfc-d0fd15486842" />

## v9-FINAL (2026-01-27)

Bumped the version and added a new notice in the `tampermonkey.user.js` file.

## v8.1 (2026-01-24)

[Vape Rewrite] is going along well, it has a Velocity and a semi-functioning KillAura (it doesn't show the blocking thing + it doesn't rotate, so if you're not looking in their direction then you'll get your hits cancelled).

[Vape Rewrite] is the current focus of ~~ProgMEM-CC~~ (this goobener barely commits and only pushed a broken + ChatGPT'd telly scaffold, what else could you expect from a skid + paster) & @6x68's time, and Impact Rewrite apparently **won't happen**.

## v8.1 (2026-01-12)

speechbubbel update real
- (unrelated) @6x68's old discord account got nuked (told someone in DMs to scan a QR code with their home address (tuff) and discord made it so I had to verify my email... that I lost access to, yay!)
- Merged PR [#101](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/pull/101) (had 67 commits, so it HAD to be done before someone ruined the commit number)

### v8 (2026-01-06)
- + Dynamic Island
- - Removed the FastBreak module.
- (2026-01-04) `Services` module is toggled on by default.

### v6.9 (2025-12-31)
- Velocity Fixed by 6x68
- + Music Player added
- + New Dynamic Island branch

### v6.8.8 (2025-12-14)
- Added IRC chat system
- New MurderMystery module for role detection
- ShowNametags module with enhanced visibility options
- (2025-12-26) Added a tiny delay to Nuker in order to fix (kick bug for too many packets)
- (2025-12-30) ChestSteal recoded
---









[Vape Rewrite]: codeberg.org/Miniblox/VapeRewrite/
<!-- yes, I did add that many newlines just for it to be on line 67 -->
