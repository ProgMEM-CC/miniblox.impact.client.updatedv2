const fs = require('fs').promises;
const path = require('path');

const SRC_DIR = 'src';
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const MAIN_FILE = path.join(SRC_DIR, 'vav4inject.js');
const BUILD_DIR = '.';
const OUTPUT_FILE = 'vav4inject.build.js';
const MODULES_PLACEHOLDER = '//<MODULES_HERE>';

async function build() {
    try {
        console.log('Starting build...');

        // 1. Read and combine all module files
        let combinedModulesCode = '';
        const moduleFiles = await fs.readdir(MODULES_DIR);
        for (const fileName of moduleFiles.filter(f => f.endsWith('.js'))) {
            const filePath = path.join(MODULES_DIR, fileName);
            console.log(`Reading module ${filePath}...`);
            const code = await fs.readFile(filePath, 'utf-8');
            combinedModulesCode += code + '\n\n';
        }

        // 2. Read the main template file
        console.log(`Reading main file ${MAIN_FILE}...`);
        let mainCode = await fs.readFile(MAIN_FILE, 'utf-8');

        // 3. Replace the placeholder with the combined module code
        console.log(`Replacing placeholder...`);
        const finalCode = mainCode.replace(MODULES_PLACEHOLDER, combinedModulesCode);

        // 4. Write the final output
        const outputPath = path.join(BUILD_DIR, OUTPUT_FILE);
        await fs.writeFile(outputPath, finalCode);
        console.log(`Build successful! Output written to ${outputPath}`);

    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();