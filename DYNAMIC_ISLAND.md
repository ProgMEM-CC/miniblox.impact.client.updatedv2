# Dynamic Island Design Document

## Overview
An iPhone-inspired dynamic information display UI for miniblox.io Impact Client.
Each module can freely request display content, with the latest request always taking priority.

---

## Core Design

### Basic Principles
- **HTML/CSS Implementation**: Implemented as DOM elements with automatic CSS transition animations
- **Simple API**: Modules just add elements to the `elements` array
- **Request-Based**: Latest request is always displayed
- **Fixed Border Radius**: 20px fixed
- **Smooth Animations**: Size transitions directly from current → next (no jank)

---

## API

### dynamicIsland.show(request)

```javascript
dynamicIsland.show({
  duration: 1500,     // Display time (ms), 0 = infinite
  width: 280,         // Width (px)
  height: 50,         // Height (px)
  elements: [...]     // Element array
});
```

### dynamicIsland.hide()
Immediately return to default display

---

## Element Types

### text - Text Display
```javascript
{
  type: "text",
  content: "Display string",
  x: 10,
  y: 20,
  color: "#fff",
  size: 14,
  align: "left",      // "left" | "center" | "right" (optional)
  bold: false,        // optional
  shadow: false       // optional
}
```

### progress - Progress Bar
```javascript
{
  type: "progress",
  value: 0.75,        // 0.0 ~ 1.0
  x: 10,
  y: 45,
  width: 280,
  height: 4,
  color: "#0FB3A0",
  bgColor: "#333",    // optional
  rounded: true       // optional
}
```

### toggle - Toggle Switch
```javascript
{
  type: "toggle",
  state: true,        // ON/OFF
  x: 250,
  y: 15,
  size: 30,
  animate: true       // If true, animates from opposite state
}
```
- `animate: true`: Slide animation from OFF→ON or ON→OFF
- `animate: false`: Instantly display current state

### image - Image/Icon
```javascript
{
  type: "image",
  src: imageObject,   // Image object or URL
  x: 10,
  y: 10,
  width: 20,
  height: 20
}
```

### variable - Variable Display (Real-time Update)
```javascript
{
  type: "variable",
  getter: () => value,        // Function that returns value
  format: "HP: {value}",      // Display format
  x: 15,
  y: 55,
  color: "#aaa",
  size: 12
}
```

---

## Animation Specifications

### Size Changes
- Transitions directly from current size → next size
- CSS transition: `width 0.3s ease-out, height 0.3s ease-out`
- No intermediate states (no jank)

### Toggle Switch
- When `animate: true`:
  - Inner circle slides from opposite side to current state
  - CSS transition: `transform 0.3s ease-out`
- When `animate: false`:
  - Instantly displays current state

### Progress Bar
- Automatically animates according to `value` changes
- CSS transition: `width 0.2s linear`

---

## Usage Examples

### Module Toggle Display
```javascript
new Module("KillAura", function(enabled) {
  dynamicIsland.show({
    duration: 1500,
    width: 280,
    height: 50,
    elements: [
      { type: "text", content: "KillAura", x: 15, y: 18, color: "#fff", size: 16, bold: true },
      { type: "text", content: enabled ? "ENABLED" : "DISABLED", x: 15, y: 35, 
        color: enabled ? "#0FB3A0" : "#ff4444", size: 11 },
      { type: "toggle", state: enabled, x: 230, y: 12, size: 26, animate: true }
    ]
  });
}, "Combat");
```

### Progress Display
```javascript
tickLoop["FastBreak"] = function() {
  const progress = (Date.now() - breakStart) / 1000;
  dynamicIsland.show({
    duration: 0,
    width: 250,
    height: 55,
    elements: [
      { type: "text", content: "Breaking Block", x: 15, y: 20, color: "#fff", size: 14 },
      { type: "progress", value: Math.min(progress, 1), x: 15, y: 35, 
        width: 220, height: 8, color: "#0FB3A0", rounded: true },
      { type: "text", content: `${Math.floor(progress * 100)}%`, x: 125, y: 28, 
        color: "#aaa", size: 11, align: "center" }
    ]
  });
};
```

### Variable Display
```javascript
dynamicIsland.show({
  duration: 0,
  width: 320,
  height: 65,
  elements: [
    { type: "text", content: "Attacking", x: 15, y: 20, color: "#ff4444", size: 14, bold: true },
    { type: "text", content: attackedEntity.name, x: 15, y: 38, color: "#fff", size: 16 },
    { type: "variable", getter: () => attackedEntity.getHealth(), 
      format: "HP: {value}/20", x: 15, y: 55, color: "#aaa", size: 12 },
    { type: "progress", value: attackedEntity.getHealth() / 20, 
      x: 15, y: 60, width: 290, height: 3, color: "#ff4444" }
  ]
});
```

---

## Module Configuration

### Category
`Render`

### Options
- `Position`: String - "Top Center" / "Top Left" / "Top Right"
- `Scale`: Number - 0.5 ~ 2.0 (default: 1.0)

---

## Default Display

When Dynamic Island module is enabled and no requests are active:
- Client name + version
- Username (if available)
- FPS + Ping

---

## Automatic Module Toggle Display

Integrated into `Module.prototype.toggle()`, automatically displays on all module toggles:
```javascript
moduleToggleDisplay.show(moduleName, enabled);
```

---

## Implementation Details

### DOM Structure
```html
<div id="dynamic-island">
  <div class="di-content">
    <!-- Elements are dynamically generated -->
  </div>
</div>
```

### Styles
```css
position: fixed;
top: 15px;
left: 50%;
transform: translateX(-50%);
background: rgba(0, 0, 0, 0.75);
backdrop-filter: blur(10px);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
transition: width 0.3s ease-out, height 0.3s ease-out;
z-index: 9999;
pointer-events: none;
```

---

## Notes

- New requests overwrite existing requests
- `duration: 0` for infinite display
- Coordinates are relative to Dynamic Island (top-left origin)
- `variable` type `getter` is called every frame
- Size changes transition directly from current → next (no intermediate states)
- Toggle `animate` flag controls animation from opposite state
