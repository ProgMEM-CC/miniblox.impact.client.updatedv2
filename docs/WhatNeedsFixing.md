# Impact Client - Issues That Need Fixing

## Critical Issues

### 1. Toggle All Command Not Working (However, .panic works tho?)
- **Status**: Non-functional
- **Location**: Command handler in vav4inject.js
- **Issue**: The `.toggle all` command is listed as non-functional in Known Issues
- **Fix Needed**: Implement logic to toggle all modules

### 2. FastBreak Module Broken
- **Status**: Not working
- **Location**: vav4inject.js - FastBreak module
- **Issue**: Listed in Known Issues as "not working"
- **Note**: Code shows it's marked as "Client-Side" but needs server-side implementation

### 3. Scaffold Success Rate ~50%
- **Status**: Partially functional
- **Location**: BETA/ScaffoldV2.js AND in injection.js
- **Issue**: New anticheat is causing placement failures
- **Fix Needed**: Better prediction/timing adjustments for block placement

### 4. AutoFunnyChat Kill Detection Issues
- **Status**: Has false positives
- **Location**: vav4inject.js - AutoFunnyChat module (line with TODO comment)
- **Issue**: Kill message detection patterns catch false positives
- **TODO Comment**: "// TODO: it aims at other players i dont kill so i need to fix this."
- **Fix Needed**: More precise victim name extraction logic

### 5. InvCleaner Duplicate Detection
- **Status**: Incomplete
- **Location**: vav4inject.js - InvCleaner module
- **Issue**: Doesn't properly detect duplicate items
- **Note**: README mentions "(but needs a recode for duplicate detection)"
- **Fix Needed**: Improve `isSameItem` function to properly identify duplicates

---

## Minor Issues

### 6. NoFall Module Conflicts

- **Status**: Potential conflicts
- **Location**: vav4inject.js - NoFall and NoFallBeta modules
- **Issue**: Two implementations both manipulate `desync` flag
- **Note**: Could conflict with Fly module
- **Fix Needed**: Consolidate implementations or add proper conflict handling

### 7. Reach Limited to 6 Blocks
- **Status**: Game limitation
- **Location**: KillAura module
- **Note**: This is a server-side limitation, not fixable client-side
- **Severity**: None (documented limitation)

---

## Code Quality Issues

### 8. Missing Error Handling
- **Status**: Stability issue
- **Locations**: Script Manager, IRC integration, various fetch calls
- **Example**:
  ```javascript
  fetch(url).then(r => r.text()).then(code => {
      // No .catch() handler
  ```
- **Fix Needed**: Add comprehensive try-catch blocks and .catch() handlers

### 9. Bind System Edge Cases
- **Status**: Minor bugs
- **Location**: Keybinding system in vav4inject.js
- **Issue**: Doesn't handle all edge cases (special keys, conflicts, etc.)
- **Fix Needed**: More robust key code handling

---

## Priority fixes

### High Priority (Fix ASAP)
1. ✅ Fix AutoFunnyChat kill detection (has active TODO comment)
2. ✅ Fix InvCleaner duplicate detection (documented in README)
3. ✅ Implement Toggle All command (user-facing feature)
4. ✅ Add better error handling to Script Manager (stability)

### Medium Priority (Soon)
5. ⚠️ Fix/improve Scaffold reliability (50% success rate)
6. ⚠️ Consolidate NoFall implementations (avoid conflicts)
8. ⚠️ Improve FastBreak or mark as deprecated

### Low Priority (we dont need to fix this)
10. 📝 Add comprehensive error handling everywhere
---

## Additional Notes
- **KillAura Air Hits**: Server-side issue, not fixable client-side (low severity)
- **Storage API**: localStorage usage is fine for userscript environment (not an issue)
- **Version Sync**: sync_version.py script handles version consistency well (working correctly)
