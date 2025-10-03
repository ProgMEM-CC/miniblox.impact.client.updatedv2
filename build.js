const fs = require('fs').promises;
const path = require('path');

const SRC_DIR = 'src';
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const MAIN_FILE = path.join(SRC_DIR, 'main.js');
const BUILD_DIR = 'build';
const OUTPUT_FILE = 'client.build.js';
const MODULES_PLACEHOLDER = '//<MODULES_HERE>';
const CLICKGUI_PLACEHOLDER = '//<CLICKGUI_HERE>'; // new placeholder

// Module loading order for dependency correctness (edit as needed)
const MODULE_ORDER = [
    'combat',
    'movement',
    'player',
    'render',
    'world',
    'utility'
];

function findDuplicateFunctions(code) {
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const functions = {};
    const duplicates = [];
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
        const funcName = match[1];
        if (functions[funcName]) {
            if (!duplicates.includes(funcName)) duplicates.push(funcName);
        } else {
            functions[funcName] = true;
        }
    }
    return duplicates;
}

function extractModuleNames(code) {
    const moduleRegex = /new\s+Module\s*\(\s*["']([^"']+)["']/g;
    const modules = [];
    let match;
    while ((match = moduleRegex.exec(code)) !== null) {
        modules.push(match[1]);
    }
    return modules;
}

function validateIntegration(code) {
    const issues = [];
    // Check if placeholders remain unreplaced
    if (code.includes(MODULES_PLACEHOLDER) || code.includes(CLICKGUI_PLACEHOLDER)) {
        issues.push('Modules/clickgui placeholder was not replaced');
    }
    // Ensure essential functions exist in the final bundle
    const essentialFunctions = ['Module', 'addModification', 'modifyCode'];
    essentialFunctions.forEach(func => {
        if (!code.includes(func)) issues.push(`Essential function '${func}' not found`);
    });
    // Basic brace counting to catch obvious syntax issues
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`Brace mismatch: ${openBraces} open, ${closeBraces} close`);
    }
    // Ensure at least one module is present
    if (!code.includes('new Module(')) {
        issues.push('No modules found in build output');
    }
    return issues;
}

// Find and return full path to a file named exactly 'clickgui.js' (case-insensitive) under dir,
// or null if not found.
async function findClickguiFilePath(dir) {
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) {
                const res = await findClickguiFilePath(full);
                if (res) return res;
            } else {
                if (item.name.toLowerCase() === 'clickgui.js') return full;
            }
        }
    } catch (e) {
        // ignore IO errors -> return null
    }
    return null;
}

// Read modules recursively, but SKIP any file named 'clickgui.js' to avoid duplication.
// category is used only to create header comments.
async function readModulesRecursively(dir, category = '') {
    let combined = '';
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        // Sort to ensure deterministic build order
        items.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
        });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                combined += await readModulesRecursively(fullPath, item.name);
            } else if (item.name.endsWith('.js')) {
                if (item.name.toLowerCase() === 'clickgui.js') {
                    // skip clickgui here; handled separately
                    continue;
                }
                const code = await fs.readFile(fullPath, 'utf-8');
                const moduleHeader = `// === ${category ? category.toUpperCase() + '/' : ''}${item.name.replace('.js', '').toUpperCase()} MODULE ===\n`;
                combined += moduleHeader + code + '\n\n';
            }
        }
    } catch (e) {
        // If modules directory doesn't exist, just return empty string
    }
    return combined;
}

async function build() {
    try {
        console.log('Starting build...');
        console.log(`Source directory: ${SRC_DIR}`);
        console.log(`Modules directory: ${MODULES_DIR}`);

        // 1) Read main template file
        console.log(`Reading main file ${MAIN_FILE}...`);
        let mainCode = await fs.readFile(MAIN_FILE, 'utf-8');

        // 2) Find clickgui.js (if any) and read it separately
        const clickguiPath = await findClickguiFilePath(SRC_DIR);
        let clickguiCode = null;
        if (clickguiPath) {
            console.log(`Found exact 'clickgui.js' at ${clickguiPath}`);
            clickguiCode = await fs.readFile(clickguiPath, 'utf-8');
        } else {
            console.log(`No exact 'clickgui.js' found under ${SRC_DIR}`);
        }

        // 3) Read and combine modules in category order, skipping clickgui.js
        let combinedModulesCode = '';
        let moduleCount = 0;
        for (const category of MODULE_ORDER) {
            const categoryPath = path.join(MODULES_DIR, category);
            try {
                await fs.access(categoryPath);
                console.log(`Processing category: ${category}`);
                const part = await readModulesRecursively(categoryPath, category);
                if (part) {
                    combinedModulesCode += part;
                    moduleCount += (part.match(/\/\/ ===/g) || []).length;
                }
            } catch (error) {
                console.log(`Category ${category} not found, skipping...`);
            }
        }

        // Read standalone JS files directly under modules directory, skipping clickgui.js
        try {
            const allItems = await fs.readdir(MODULES_DIR, { withFileTypes: true });
            for (const item of allItems) {
                if (item.isFile() && item.name.endsWith('.js')) {
                    if (item.name.toLowerCase() === 'clickgui.js') continue; // skip
                    const fullPath = path.join(MODULES_DIR, item.name);
                    console.log(`Reading standalone module ${fullPath}...`);
                    const code = await fs.readFile(fullPath, 'utf-8');
                    const moduleHeader = `// === ${item.name.replace('.js', '').toUpperCase()} MODULE ===\n`;
                    combinedModulesCode += moduleHeader + code + '\n\n';
                    moduleCount++;
                }
            }
        } catch (e) {
            // If modules directory doesn't exist, ignore
        }

        console.log(`Loaded ${moduleCount} modules`);

        // 4) Optimization & diagnostics
        console.log('Optimizing modules...');
        const duplicateFunctions = findDuplicateFunctions(combinedModulesCode);
        if (duplicateFunctions.length > 0) {
            console.warn(`Warning: Found ${duplicateFunctions.length} potential duplicate functions:`);
            duplicateFunctions.forEach(func => console.warn(` - ${func}`));
        }
        const moduleNames = extractModuleNames(combinedModulesCode);
        console.log(`Detected modules: ${moduleNames.join(', ')}`);

        // 5) Insert into placeholders:
        //    - If present, place combinedModulesCode into //<MODULES_HERE>
        //    - If clickguiCode exists and //<CLICKGUI_HERE> present, place clickguiCode there
        //    - Fallbacks: if a placeholder is missing, append missing parts to the end so nothing is dropped.
        console.log('Replacing placeholders...');
        let finalCode = mainCode;
        const hasModulesPlaceholder = mainCode.includes(MODULES_PLACEHOLDER);
        const hasClickguiPlaceholder = mainCode.includes(CLICKGUI_PLACEHOLDER);

        // Insert modules if placeholder exists
        let placedModules = false;
        if (hasModulesPlaceholder) {
            finalCode = finalCode.replace(MODULES_PLACEHOLDER, combinedModulesCode);
            placedModules = true;
            console.log(`Inserted modules into ${MODULES_PLACEHOLDER}`);
        }

        // Insert clickgui if found and placeholder exists
        let placedClickgui = false;
        if (clickguiCode && hasClickguiPlaceholder) {
            finalCode = finalCode.replace(CLICKGUI_PLACEHOLDER, clickguiCode);
            placedClickgui = true;
            console.log(`Inserted clickgui into ${CLICKGUI_PLACEHOLDER}`);
        }

        // Fallback behaviors:
        // If modules placeholder was missing, append modules at end (unless they were already placed)
        if (!placedModules && combinedModulesCode) {
            if (placedClickgui) {
                // clickgui already placed somewhere; append modules after file
                finalCode = finalCode + '\n\n' + combinedModulesCode;
                console.log('Modules placeholder missing -> appended modules to file end');
            } else {
                // neither placeholder existed or modules not placed: append modules (and clickgui if exists) at end
                finalCode = finalCode + '\n\n' + combinedModulesCode;
                console.log('Modules placeholder missing -> appended modules to file end');
            }
        }

        // If clickgui exists but wasn't placed (placeholder missing), append clickgui after modules or to end
        if (clickguiCode && !placedClickgui) {
            finalCode = finalCode + '\n\n' + clickguiCode;
            console.log('Clickgui placeholder missing -> appended clickgui to file end');
        }

        // 6) Write build output
        await fs.mkdir(BUILD_DIR, { recursive: true });
        const outputPath = path.join(BUILD_DIR, OUTPUT_FILE);
        await fs.writeFile(outputPath, finalCode);

        // 7) Validation & metadata
        console.log('Validating integration...');
        const integrationIssues = validateIntegration(finalCode);
        if (integrationIssues.length > 0) {
            console.warn('Integration issues found:');
            integrationIssues.forEach(issue => console.warn(` - ${issue}`));
        } else {
            console.log('Integration validation passed');
        }

        const stats = {
            totalLines: finalCode.split('\n').length,
            totalSize: Buffer.byteLength(finalCode, 'utf8'),
            moduleCount: moduleCount,
            moduleNames: moduleNames,
            buildTime: new Date().toISOString(),
            integrationIssues: integrationIssues.length
        };
        const metadataPath = path.join(BUILD_DIR, 'build-metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(stats, null, 2));

        console.log(`Build successful! Output written to ${outputPath}`);
        console.log(`Stats: lines=${stats.totalLines} size=${stats.totalSize} modules=${stats.moduleCount} issues=${stats.integrationIssues}`);

    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
