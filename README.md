# [![Impact V8](https://readme-typing-svg.demolab.com?font=Fira+Code&duration=3500&pause=2000&color=FF0000&width=435&lines=Impact+Client+V8)](https://git.io/typing-svg)
[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&duration=2500&pause=1000&color=abe0e4&vCenter=true&width=600&lines=The+ultimate+Miniblox+hacked+client!;Built+for+stealth+(from+AntiCheats)%2C+speed%2C+and+total+domination.;Fully+dark-mode+optimized+with+a+modern+GUI)](https://git.io/typing-svg)

## A feature-rich client modification for Miniblox.io with enhanced gameplay capabilities, stealth optimization, and a modern, dark-mode user interface

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2)](https://discord.gg/PwpGemYhJx)
[![Website](https://img.shields.io/badge/Website-impactminiblox.js.org-blue)](https://impactminiblox.js.org)

---

## ⚠️ Important Disclaimer.

**PLEASE READ BEFORE INSTALLING**: This client modification may violate Miniblox.io's Terms of Service. Use at your **own risk**. The Developers of Impact are not responsible for any account actions, bans, or consequences resulting from use of this software. By installing this client, **you acknowledge and accept these risks**.

---

## Quick Start

### Prerequisites

- A userscript manager extension (Tampermonkey, Violentmonkey, or Greasemonkey)
- Chrome, Firefox, or Edge browser

### Installation

1. **Install one of the three main userscript managers** from your browser's extension store (if you haven't already)
   - [Tampermonkey](https://www.tampermonkey.net/) (this is recommended)
   - [Violentmonkey](https://violentmonkey.github.io/) (MV2 / Manifest v2, but some users reported success in using this userscript manager when Tampermonkey fails)
   - [Greasemonkey](https://www.greasespot.net/) (**not recommended** as it is old, please use Tampermonkey or Violentmonkey.)

2. **Copy the script**
   - Open `tampermonkey.user.js` from this repository
   - Copy all contents

3. **Create new userscript**
   - Click your userscript manager icon
   - Select "Create new script"
   - Paste the copied contents
   - Save (Ctrl+S or Cmd+S)

4. **Launch the client**
   - Navigate to [miniblox.io](https://miniblox.io)
   - The client will auto-initialize

5. **Troubleshooting**
   - **Tampermonkey users**: If the script doesn't load, go to Extensions → Manage Extensions → Tampermonkey → Toggle "Allow User Scripts" permission ([FAQ #209](https://www.tampermonkey.net/faq.php#Q209))
   - See our [FAQ](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/wiki/FAQ) for additional help

---

## Features

### Movement Modules
- **Fly** - Enhanced movement with customizable speed (With desync created by 6x68)
- **NoFall** / **NoFallBeta** - Prevents fall damage (Use NoFallBeta lol.)
- **Scaffold** - Automatic block placement under player
- **Jetpack** - Legacy fly mode with desync support
- **LongJump** - Extended jump distance with desync

### Combat Modules
- **KillAura** - Automated combat (limited to 6 block reach because of anticheat)

### Utility Modules
- **AntiBan 2.0** - Account protection with optional account generation
- **InvManager** - Automatic inventory organization
- **ServerCrasher** - Server "stress testing" (now it should work since the working settings are hardcoded into the server crasher module)
- **Nuker** - Rapid block breaking
- **ChestSteal** - Steals items/armor from chest quickly

### Visual Modules
- **ClickGUI** - A Modern interface for module management
- **TextGUI** - A Alternative for a text-based interface
- **MurderMystery** - Player role detection for Murder Mystery gamemode!
- **ShowNametags** - Enhanced nametag visibility options

### Social Features
- **IRC Integration** - In-game chat system (`.chat` command, enable the `Services` module first AND set the name to whatever you want)
- **Discord Bridge** - Connect IRC with Discord server (when @6x68 is online, and is hosting the bot (almost never))
- **Friend System** - Manage trusted players (`.friend` command)
- **Script Manager** - Custom script support (`.scriptmanager` command)
- **Bug Reports** - In-game reporting (`.report` command)

---

## Known Issues

| Issues                                    | Severity | Status + Notes                    |
| ----------------------------------------- | -------- | --------------------------------- |
| Tampermonkey Extra Permission Requirement | Low      | This has been documented.         |
| Error Handling                            | Low      | Stability improvements needed.    |

For detailed information + workarounds, see our [FAQ](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/wiki/FAQ).

## Additional Notes

- **KillAura Air Hits**: Server-side issue, not fixable client-side (low severity)
- **Storage API**: localStorage usage is fine for userscript environment (not an issue)
- **Version Sync**: sync_version.py script handles version consistency well (working correctly)

---

## 🧑‍💻 Recent Update Logs

## v8.1 (2026-01-12)

speechbubbel update real
- (unrelated) @6x68's discord account (datamodel.1) got nuked (told someone in DMs to scan a QR code with their home address (tuff) and discord made it so I had to verify my email... that I lost access to, yay!)
- Merged PR [#101](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/pull/101) (had 67 commits, so it HAD to be done before someone ruined the commit number)

### v8 (2026-01-06)
- Big 2026 update!
- Dynamic Island Progress.. :D
- Removed FastBreak + AutoFunnyChat Module
- AutoSync version to v8 (by ImpactV8CheatsBot)
- (2026-01-04) `Services` module is toggled on by default.

### v6.9 (2025-12-31)
- AutoSync version to v6.9 (by old ImpactV6CheatsBot)
- Velocity Fix by @6x68
- Music Player added!
- New Dynamic Island branch

### v6.8.8 (2025-12-14)
- Added IRC chat system
- New MurderMystery module for role detection
- ShowNametags module with enhanced visibility options
- (2025-12-26) Added a tiny delay to Nuker in order to fix
- (2025-12-27) AutoFunnyChat update!
- (2025-12-30) ChestSteal recode! 

### v6.8.7 (2025-11-11)
- Improved update consistency
- Documentation updates

### v6.8.5 (2025-11-08)
- Multiple contribution updates
- Music Player branch improvements
- Version synchronization

---

## Project History

**Impact For Miniblox** is a fork of the **Vape V4** project by `6x68` (known as DataM0del)
(which is a continuation of the discontinued **Vape V4** project by `7GrandDadPGN`).
Before the original client was deleted ([xylex fake quit moment](https://github.com/7GrandDadPGN/7granddadpgn/commit/46a3b9e9afea226f730b9d9eaf10788b993d43ee#commitcomment-152355396)) 🥀
<!-- why am I adding all of these dates, this isn't history class LOL -->
**6x68** started updating it 13 days before that comment, and then stopped 2 days after.
But it was fully usable 3 days after that comment, and then, the first updated version of Vape, 3.0.0, was released.

---

**Branch Strategy**: 
- `main` - Stable releases only
- `beta` - Testing and experimental features

**Code Standards**: Follow existing code style and comment logic.

### Feature Requests & Bug Reports

- Use GitHub Issues for bug reports
- Join our [Discord](https://discord.gg/PwpGemYhJx) for feature discussions
- Submit media showcases via [Discussion](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/discussions/new?category=media-addition-requests)

---

## Community

- **Discord**: [Join our server today](https://discord.gg/PwpGemYhJx)
- **Website**: [impactminiblox.js.org](https://impactminiblox.js.org)
- **GitHub**: [Repository](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2)

### Community Showcase

[![Video Showcase](https://i.ytimg.com/vi/dSR7u0OQcrQ/hqdefault.jpg)](https://www.youtube.com/watch?v=dSR7u0OQcrQ)

Want your video featured? [Submit here](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/discussions/new?category=media-addition-requests)

---

## Contributors

| Contributor                                                                 | Role                                   |
| --------------------------------------------------------------------------- | -------------------------------------- |
| [7GrandDadPGN](https://github.com/7GrandDadPGN)                             | Original creator of Vape V4            |
| [DataM0del](https://github.com/DataM0del) / [6x68](https://github.com/6x68) | Core developer                         |
| [TheM1ddleM1n](https://github.com/TheM1ddleM1n)                             | Core developer + GitHub maintainer     |
| [ProgMEM-CC](https://github.com/ProgMEM-CC)                                 | Repository management & infrastructure |
| [dtkiller-jp](https://github.com/dtkiller-jp)                               | GUI developer                          |

---

## License & Legal

This software is provided as-is without any warranties. Users are solely responsible for compliance with Miniblox.io's Terms of Service and any applicable laws. The developers disclaim all liability for misuse or consequences of using this software.

**By using this client, you will accept the full responsibility for any actions taken against your account.**

---

## Support

- Check the [FAQ](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/wiki/FAQ) first
- Search the existing [GitHub Issues](https://github.com/ProgMEM-CC/miniblox.impact.client.updatedv2/issues)
- Ask in our [Discord Server](https://discord.gg/PwpGemYhJx)
- Create a new issue with detailed info
