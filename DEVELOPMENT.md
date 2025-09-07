# Developer Guide - Miniblox Impact Client v4

## 📁 Project Structure

```
src/
├── main.js                 # Main file (anticheat, hooks, core functions)
└── modules/               # Module directory
    ├── combat/           # Combat modules
    │   ├── autoclicker.js
    │   ├── killaura.js
    │   ├── velocity.js
    │   └── wtap.js
    ├── movement/         # Movement modules
    │   ├── fly.js
    │   ├── jetpack.js
    │   ├── infinitefly.js
    │   ├── keepsprint.js
    │   ├── noslowdown.js
    │   ├── sprint.js
    │   ├── phase.js
    │   ├── invwalk.js
    │   ├── jesus.js
    │   ├── step.js
    │   └── spiderclimb.js
    ├── player/           # Player modules
    │   ├── nofall.js
    │   ├── antifall.js
    │   ├── autoarmor.js
    │   ├── invcleaner.js
    │   ├── ghostjoin.js
    │   └── playeresp.js
    ├── world/            # World modules
    │   ├── fastbreak.js
    │   ├── breaker.js
    │   ├── autocraft.js
    │   ├── cheststeal.js
    │   ├── timer.js
    │   └── scaffold.js
    ├── utility/          # Utility modules
    │   ├── autorespawn.js
    │   ├── autorejoin.js
    │   ├── antiban.js
    │   ├── autofunnychat.js
    │   ├── chatdisabler.js
    │   ├── filterbypass.js
    │   ├── autoqueue.js
    │   ├── autovote.js
    │   ├── anticheat.js
    │   └── musicfix.js
    └── render/           # Rendering modules
        ├── clickgui.js
        ├── textgui.js
        ├── chams.js
        └── nametags.js
```

## 🔧 Build System

### Build Process
1. `build.js` recursively reads all `.js` files in `src/modules/`
2. Combines all module code
3. Injects into `src/main.js` at `//<MODULES_HERE>` placeholder
4. Outputs to `build/client.build.js`

### Build Commands
```bash
# Lint + Build
npm run build

# Build only
node build.js

# Lint only
npm run lint
```

## 📝 Creating New Modules

### 1. Basic Module Structure

```javascript
/**
 * ModuleName Module
 */

new Module("ModuleName", function(callback) {
    if (callback) {
        // Code executed when module is enabled
        tickLoop["ModuleName"] = function() {
            // Code executed every tick
        };
    } else {
        // Code executed when module is disabled
        delete tickLoop["ModuleName"];
    }
});
```

### 2. Module with Options

```javascript
/**
 * ModuleName Module
 */

let moduleOption1, moduleOption2;
const moduleName = new Module("ModuleName", function(callback) {
    if (callback) {
        tickLoop["ModuleName"] = function() {
            // Access option values with moduleOption1[1], moduleOption2[1]
        };
    } else {
        delete tickLoop["ModuleName"];
    }
});

// Define options
moduleOption1 = moduleName.addoption("Option1", Number, 1.0);
moduleOption2 = moduleName.addoption("Option2", Boolean, true);
```

### 3. File Placement

Place module files in appropriate category folders:

- **Combat**: Combat-related (autoclicker, killaura, etc.)
- **Movement**: Movement-related (fly, speed, jump, etc.)
- **Player**: Player-related (nofall, autoarmor, etc.)
- **World**: World-related (fastbreak, scaffold, etc.)
- **Utility**: Utilities (autorespawn, chat-related, etc.)
- **Render**: Rendering-related (ESP, GUI, text, etc.)

### 4. Adding to ClickGUI

New modules are automatically displayed in ClickGUI. Categories are defined in:

`src/modules/render/clickgui.js` within the `categories` object.

## 🎯 Development Best Practices

### 1. Coding Standards
- Use ES11 (ES2020) syntax
- Follow JSHint rules (see `.jshintrc`)
- Write appropriate comments

### 2. Module Design
- Follow single responsibility principle
- Minimize dependencies between modules
- Implement with performance in mind

### 3. Testing
- Always run `npm run build` after adding new modules
- Test in actual game environment

### 4. Debugging
- Use `console.log()` for debug output
- Utilize browser developer tools

## 🔍 Troubleshooting

### Build Errors
- JSHint errors: Check `.jshintrc` configuration
- File reading errors: Check file paths and permissions

### Module Not Working
- Check `tickLoop` registration
- Verify callback function implementation
- Check console errors

### Performance Issues
- Optimize `tickLoop` processing
- Reduce unnecessary calculations
- Use conditional branching for performance

## 📚 References

- [JSHint Documentation](https://jshint.com/docs/)
- [ES2020 Features](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- Reference existing modules in the project

## 🤝 Contributing

1. Develop new features in appropriate branches
2. Get code reviews
3. Run tests before merging
4. Update documentation
