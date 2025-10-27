# Script Manager Documentation

## Overview

Script Manager allows you to load and manage custom scripts in Impact for Miniblox. Scripts are executed in the same scope as the main client, giving them full access to all modules, functions, and variables.

## How to Open Script Manager

### Via ClickGUI

1. Press `\` (Backslash) to open ClickGUI
2. Click `Misc` category
3. Toggle `ScriptManager`

### Via Command (in miniblox)

Type `.scriptmanager` in chat

## Loading Scripts!

### 📁 Load File (Local File)

1. Click "📁 Load File"
2. Select a `.js` file from your computer
3. The script will be loaded and executed immediately
4. Any modules created will appear in the `Scripts` category in ClickGUI

### 🌐 Load URL

1. Click "🌐 Load URL"
2. Enter the URL of a JavaScript file
3. The script will be fetched and executed

### ✏️ Write Code

1. Click "✏️ Write Code"
2. Enter a script name (this is just for identification)
3. Write your code in the editor
4. Click "Save & Load"

## Managing these Scripts

### 📋 Duplicate Scripts

- Click the 📋 button next to a script
- Creates a copy with `-2`, `-3`, etc. appended to the name
- Useful for testing variations

### 🗑️ Delete Scripts

- Click the 🗑️ button next to a script
- Confirms before deletion
- Removes all modules created by the script
- Clears saved data from LocalStorage

## Script Format

Scripts are executed using `eval()` in the same scope as the main client. This means you have direct access to all variables and functions.

### Basic Module Example

```javascript
new Module("MyModule", function(enabled) {
  if (enabled) {
    console.log("Module enabled!");
  } else {
    console.log("Module disabled!");
  }
});
```

### Module with Tick Loop

```javascript
new Module("TickModule", function(enabled) {
  if (enabled) {
    tickLoop["TickModule"] = function() {
      if (player) {
        console.log("Player position:", player.pos);
      }
    };
  } else {
    delete tickLoop["TickModule"];
  }
});
```

### Module with Options

```javascript
let jumpHeight, autoJump, message;

const myModule = new Module("ConfigurableModule", function(enabled) {
  if (enabled) {
    tickLoop["ConfigurableModule"] = function() {
      if (player && autoJump[1]) {
        player.motion.y = jumpHeight[1];
      }
    };
  } else {
    delete tickLoop["ConfigurableModule"];
  }
});

jumpHeight = myModule.addoption("JumpHeight", Number, 0.42);
autoJump = myModule.addoption("AutoJump", Boolean, true);
message = myModule.addoption("Message", String, "Hello");
```

## Available Variables

Since scripts run in the same scope, you have access to everything:

### Core

- `Module` - Module class constructor
- `modules` - Object containing all modules
- `enabledModules` - Object containing enabled modules
- `tickLoop` - Object for tick-based loops (runs every game tick)
- `renderTickLoop` - Object for render-based loops (runs every frame)
- `keybindCallbacks` - Object for keybind callbacks

### Game Objects

- `player` - Player entity
- `game` - Game instance
- `ClientSocket` - Network socket for sending packets

### Helper Functions

- `keyPressedDump(key)` - Check if a key is pressed (e.g., "space", "shift")
- `getMoveDirection(speed)` - Get movement direction vector based on input
- `getModule(name)` - Get a module by name
- `rayTraceBlocks(start, end, ...)` - Ray trace for blocks

### World & Blocks

- `BlockPos` - Block position class
- `Vector3$1` - Vector3 class
- `Materials` - Block materials
- `EnumFacing` - Direction enum
- `BlockAir` - Air block class

### Packets

- `SPacketMessage` - Chat message packet
- `SPacketClick` - Click packet
- `SPacketBreakBlock` - Break block packet
- `SPacketUseEntity` - Use entity packet
- `SPacketUseItem` - Use item packet
- `SPacketPlayerAction` - Player action packet
- `SPacketPlayerPosLook` - Position/look packet
- And many more...

### Items & Entities

- `ItemSword`, `ItemArmor`, `ItemBlock`, `ItemTool`, `ItemAppleGold`
- `EntityPlayer`
- `Items` - All items
- `Enchantments` - All enchantments

### Other

- `playerControllerMP` - Player controller
- `hud3D` - 3D HUD
- `friends` - Friends list array
- `VERSION` - The clients version

## Persistence

- Scripts are automatically saved to LocalStorage
- They will be loaded automatically on the next startup (by reload)
- Deleting a script removes it from storage
- Modules created by scripts appear in the `Scripts` category in ClickGUI

## 💡 Tips!

### Clean Up Resources
Always clean up in the disable function:
```javascript
new Module("MyModule", function(enabled) {
  if (enabled) {
    tickLoop["MyModule"] = function() {
      // Your code
    };
  } else {
    delete tickLoop["MyModule"]; // Important!
  }
});
```

### Check for Null

Player and game might not be available immediately:
```javascript
tickLoop["MyModule"] = function() {
  if (!player || !game) return;
  // Your code
};
```

### Use Render Loop for Visual Effects

```javascript
new Module("MyVisual", function(enabled) {
  if (enabled) {
    renderTickLoop["MyVisual"] = function() {
      // Runs every frame
    };
  } else {
    delete renderTickLoop["MyVisual"];
  }
});
```

## Troubleshooting

### Script doesn't load

- Check browser console (F12) for errors
- Verify that your syntax is correct
- Make sure you're creating a `new Module(...)`

### Module doesn't appear in ClickGUI?

- Check if the module was created successfully
- Look in the `Scripts` category
- Reload the page and try again

### Script error message

- Read the error message in the alert dialog
- Check console for detailed error with line numbers
- Fix these syntax errors and reload the script

## Example: Complete Module

```javascript
// Variables for options
let speed, jumpHeight, autoJump;

// Create the module
const myModule = new Module("CustomFly", function(enabled) {
  if (enabled) {
    console.log("CustomFly enabled!");
    
    tickLoop["CustomFly"] = function() {
      // Check if player exists
      if (!player) return;
      
      // Get movement direction
      const dir = getMoveDirection(speed[1]);
      
      // Apply movement
      player.motion.x = dir.x;
      player.motion.z = dir.z;
      
      // Handle vertical movement
      if (keyPressedDump("space")) {
        player.motion.y = jumpHeight[1];
      } else if (keyPressedDump("shift")) {
        player.motion.y = -jumpHeight[1];
      } else if (autoJump[1]) {
        player.motion.y = 0;
      }
    };
  } else {
    console.log("CustomFly disabled!");
    delete tickLoop["CustomFly"];
  }
});

// Add options
speed = myModule.addoption("Speed", Number, 0.5);
jumpHeight = myModule.addoption("JumpHeight", Number, 0.42);
autoJump = myModule.addoption("AutoHover", Boolean, true);
```

## Notes

- Scripts have full access to the client's scope
- Be careful with what scripts you load from untrusted sources
- Scripts persist across sessions via LocalStorage
- You can have multiple modules in one script file
