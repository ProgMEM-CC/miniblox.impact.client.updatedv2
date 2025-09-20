const fs = require('fs').promises;
const path = require('path');

const SRC_DIR = 'src';
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const MAIN_FILE = path.join(SRC_DIR, 'main.js');
const BUILD_DIR = 'build';
const OUTPUT_FILE = 'client.build.js';
const MODULES_PLACEHOLDER = '//<MODULES_HERE>';

// Module loading order for proper dependencies
const MODULE_ORDER = [
    'combat',
    'movement', 
    'player',
    'render',
    'world',
    'utility'
];

// Helper functions for build optimization
function findDuplicateFunctions(code) {
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const functions = {};
    const duplicates = [];
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
        const funcName = match[1];
        if (functions[funcName]) {
            if (!duplicates.includes(funcName)) {
                duplicates.push(funcName);
            }
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
    
    // Check for placeholder replacement
    if (code.includes(MODULES_PLACEHOLDER)) {
        issues.push('Modules placeholder was not replaced');
    }
    
    // Check for essential functions
    const essentialFunctions = ['Module', 'addModification', 'modifyCode'];
    essentialFunctions.forEach(func => {
        if (!code.includes(func)) {
            issues.push(`Essential function '${func}' not found`);
        }
    });
    
    // Check for syntax errors (basic)
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`Brace mismatch: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for module initialization
    if (!code.includes('new Module(')) {
        issues.push('No modules found in build output');
    }
    
    return issues;
}

async function build() {
    try {
        console.log('Starting build...');
        console.log(`📁 Source directory: ${SRC_DIR}`);
        console.log(`📦 Modules directory: ${MODULES_DIR}`);

        // 1. Read the main template file first
        console.log(`Reading main file ${MAIN_FILE}...`);
        let mainCode = await fs.readFile(MAIN_FILE, 'utf-8');

        // 2. Read and combine all module files in proper order
        let combinedModulesCode = '';
        let moduleCount = 0;
        
        async function readModulesRecursively(dir, category = '') {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            // Sort items to ensure consistent build order
            items.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    // Recursively read subdirectories
                    await readModulesRecursively(fullPath, item.name);
                } else if (item.name.endsWith('.js')) {
                    // Read JavaScript files
                    console.log(`Reading module ${fullPath}...`);
                    const code = await fs.readFile(fullPath, 'utf-8');
                    
                    // Add module header comment for debugging
                    const moduleHeader = `// === ${category ? category.toUpperCase() + '/' : ''}${item.name.replace('.js', '').toUpperCase()} MODULE ===\n`;
                    combinedModulesCode += moduleHeader + code + '\n\n';
                    moduleCount++;
                }
            }
        }
        
        // Read modules in proper order
        for (const category of MODULE_ORDER) {
            const categoryPath = path.join(MODULES_DIR, category);
            try {
                await fs.access(categoryPath);
                console.log(`📂 Processing category: ${category}`);
                await readModulesRecursively(categoryPath, category);
            } catch (error) {
                console.log(`⚠️  Category ${category} not found, skipping...`);
            }
        }
        
        // Read any remaining modules not in predefined categories
        const allItems = await fs.readdir(MODULES_DIR, { withFileTypes: true });
        for (const item of allItems) {
            if (item.isFile() && item.name.endsWith('.js')) {
                const fullPath = path.join(MODULES_DIR, item.name);
                console.log(`Reading standalone module ${fullPath}...`);
                const code = await fs.readFile(fullPath, 'utf-8');
                const moduleHeader = `// === ${item.name.replace('.js', '').toUpperCase()} MODULE ===\n`;
                combinedModulesCode += moduleHeader + code + '\n\n';
                moduleCount++;
            }
        }

        console.log(`✅ Loaded ${moduleCount} modules`);

        // 3. Optimize and validate the combined module code
        console.log(`🔍 Optimizing modules...`);
        
        // Check for potential issues
        const duplicateFunctions = findDuplicateFunctions(combinedModulesCode);
        if (duplicateFunctions.length > 0) {
            console.warn(`⚠️  Warning: Found ${duplicateFunctions.length} potential duplicate functions:`);
            duplicateFunctions.forEach(func => console.warn(`   - ${func}`));
        }
        
        // Add integration validation
        const moduleNames = extractModuleNames(combinedModulesCode);
        console.log(`📋 Detected modules: ${moduleNames.join(', ')}`);
        
        // 4. Replace the placeholder with the combined module code
        console.log(`Replacing placeholder...`);
        if (!mainCode.includes(MODULES_PLACEHOLDER)) {
            console.warn(`⚠️  Warning: Placeholder "${MODULES_PLACEHOLDER}" not found in main file!`);
        }
        
        const finalCode = mainCode.replace(MODULES_PLACEHOLDER, combinedModulesCode);

        // 4. Ensure build directory exists
        await fs.mkdir(BUILD_DIR, { recursive: true });

        // 5. Write the final output
        const outputPath = path.join(BUILD_DIR, OUTPUT_FILE);
        await fs.writeFile(outputPath, finalCode);
        
        // 6. Validate integration completeness
        console.log(`🔍 Validating integration...`);
        const integrationIssues = validateIntegration(finalCode);
        if (integrationIssues.length > 0) {
            console.warn(`⚠️  Integration issues found:`);
            integrationIssues.forEach(issue => console.warn(`   - ${issue}`));
        } else {
            console.log(`✅ Integration validation passed`);
        }
        
        // 7. Generate build statistics
        const stats = {
            totalLines: finalCode.split('\n').length,
            totalSize: Buffer.byteLength(finalCode, 'utf8'),
            moduleCount: moduleCount,
            moduleNames: extractModuleNames(combinedModulesCode),
            buildTime: new Date().toISOString(),
            integrationIssues: integrationIssues.length
        };
        
        // Write build metadata
        const metadataPath = path.join(BUILD_DIR, 'build-metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(stats, null, 2));
        
        console.log(`✅ Build successful! Output written to ${outputPath}`);
        console.log(`📊 Build Stats:`);
        console.log(`   📝 Total lines: ${stats.totalLines}`);
        console.log(`   📏 Total size: ${stats.totalSize} bytes`);
        console.log(`   📦 Modules: ${stats.moduleCount} (${stats.moduleNames.length} detected)`);
        console.log(`   ⚠️  Issues: ${stats.integrationIssues}`);
        console.log(`   ⏰ Build time: ${stats.buildTime}`);
        console.log(`   📄 Metadata: ${metadataPath}`);

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();