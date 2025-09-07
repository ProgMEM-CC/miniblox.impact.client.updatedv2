const fs = require('fs').promises;
const path = require('path');

const SRC_DIR = 'src';
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const MAIN_FILE = path.join(SRC_DIR, 'main.js');
const BUILD_DIR = 'build';
const OUTPUT_FILE = 'client.build.js';
const MODULES_PLACEHOLDER = '//<MODULES_HERE>';

async function build() {
    try {
        console.log('Starting build...');

        // 1. Add global variable declarations for modules
        let combinedModulesCode = `
// Global variables injected for module compatibility
// These variables are defined in the main script context and made available to modules
var game, player, controls, hud3D, ClientSocket, playerControllerMP, playerControllerDump;
var keyPressedDump, moveStrafeDump, moveForwardDump, entitiesDump, isInvisibleDump, attackDump;
var lastReportedYawDump, windowClickDump, damageReduceAmountDump, boxGeometryDump, syncItemDump;
var Vector3$1, BlockPos, EnumFacing, Materials, Items, Enchantments;
var EntityPlayer, ItemSword, ItemArmor, ItemBlock, ItemTool, ItemAppleGold;
var SPacketPlayerPosLook, SPacketMessage, SPacketClick, SPacketUseEntity, SPacketUseItem, SPacketPlayerAction, SPacketRespawn$1, SPacketCraftItem;
var PBVector3, PBAction, ContainerChest, Mesh;
var rayTraceBlocks, canCraftItem, craftItem, recipes, degToRad;
var MSPT;

`;
        
        // 2. Read and combine all module files recursively
        async function readModulesRecursively(dir) {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    // Recursively read subdirectories
                    await readModulesRecursively(fullPath);
                } else if (item.name.endsWith('.js')) {
                    // Read JavaScript files
                    console.log(`Reading module ${fullPath}...`);
                    const code = await fs.readFile(fullPath, 'utf-8');
                    combinedModulesCode += code + '\n\n';
                }
            }
        }
        
        await readModulesRecursively(MODULES_DIR);

        // 2. Read the main template file
        console.log(`Reading main file ${MAIN_FILE}...`);
        let mainCode = await fs.readFile(MAIN_FILE, 'utf-8');

        // 3. Replace the placeholder with the combined module code
        console.log(`Replacing placeholder...`);
        const finalCode = mainCode.replace(MODULES_PLACEHOLDER, combinedModulesCode);

        // 4. Ensure build directory exists
        await fs.mkdir(BUILD_DIR, { recursive: true });

        // 5. Write the final output
        const outputPath = path.join(BUILD_DIR, OUTPUT_FILE);
        await fs.writeFile(outputPath, finalCode);
        console.log(`Build successful! Output written to ${outputPath}`);

    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();