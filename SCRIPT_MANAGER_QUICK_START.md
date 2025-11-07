# Script Manager Quick Start

## 5-Minute Guide

### Step 1: How to Open `Script Manager`?

- Press `\` (Backslash) to open ClickGUI
- Click `Misc` → Toggle `ScriptManager` on!
- Or you can type `.scriptmanager` in chat

### Step 2: Create Your First Script

1. Click on "✏️ Write Code"
2. Enter a name: `MyFirstScript`
3. Paste this code:

```javascript
new Module("HelloWorld", function(enabled) {
  if (enabled) {
    console.log("Hello from my custom script!");
    tickLoop["HelloWorld"] = function() {
      if (player) {
        // Your code runs here every tick
      }
    };
  } else {
    console.log("Goodbye!");
    delete tickLoop["HelloWorld"];
  }
});
```

4. Click on "Save & Load"
5. Close the Script Manager UI
6. And open the ClickGUI → And click on the `Scripts` category
7. Finally, toggle the `HelloWorld` module!

### Step 3: Load the Existing Scripts

To load scripts from the BETA folder:
1. Click "📁 Load File"
2. Select `BETA/jetpack.js` or `BETA/test-simple.js`
3. The module will appear in ClickGUI under `Scripts`

## Quick Examples

### A Simple Toggle Module!

```javascript
new Module("SimpleModule", function(enabled) {
  if (enabled) {
    console.log("Enabled!");
  } else {
    console.log("Disabled!");
  }
});
```

### Module with `addoptions`

```javascript
let mySpeed;

const mod = new Module("SpeedModule", function(enabled) {
  if (enabled) {
    tickLoop["SpeedModule"] = function() {
      if (player) {
        const dir = getMoveDirection(mySpeed[1]);
        player.motion.x = dir.x;
        player.motion.z = dir.z;
      }
    };
  } else {
    delete tickLoop["SpeedModule"];
  }
});

mySpeed = mod.addoption("Speed", Number, 0.5);
```

### Visual Module (via a `renderTickLoop`)

```javascript
new Module("VisualModule", function(enabled) {
  if (enabled) {
    renderTickLoop["VisualModule"] = function() {
      // Runs every frame
      console.log("Rendering...");
    };
  } else {
    delete renderTickLoop["VisualModule"];
  }
});
```

## Tips

- Always delete your tickLoop/renderTickLoop when disabling.
- Check if `player` exists before using it.
- Use `console.log()` for debugging.
- Scripts are saved automatically and load on restart.
- Check browser console (F12) for errors.

## Next Steps

- Read the full [Script Manager Documentation](SCRIPT_MANAGER.md)
- Explore the BETA folder for more examples!
- Experiment with different modules!
- Share your scripts with the Impact Community - via here or discord!!
