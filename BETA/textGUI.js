addModification('COLOR_TOOLTIP_BG,BORDER_SIZE)}', `
    function drawImage(ctx, img, posX, posY, sizeX, sizeY, color) {
        if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(posX, posY, sizeX, sizeY);
            ctx.globalCompositeOperation = "destination-in";
        }
        ctx.drawImage(img, posX, posY, sizeX, sizeY);
        if (color) ctx.globalCompositeOperation = "source-over";
    }
`);

addModification(
  '(this.drawSelectedItemStack(),this.drawHintBox())',
  /*js*/`
    if (ctx$5 && enabledModules["TextGUI"]) {
        const colorOffset = Date.now() / 4000;

        const canvasW = ctx$5.canvas.width;
        const canvasH = ctx$5.canvas.height;

        ctx$5.imageSmoothingEnabled = true;
        ctx$5.imageSmoothingQuality = "high";

  // === Mode store ===
  const moduleModes = {
  autofunnychat: "Meme",
  AutoRespawn: "Instant",
  ChatDisabler: "Packets",
  NoSlowdown: "Vanilla",
  FilterBypass: "Unicode",
  NameTags: "Custom",
  AutoClicker: "RMB",
  AutoQueue: "Instant",
  ChestSteal: "Hypixel",
  KeepSprint: "All",
  InvCleaner: "Normal",
  AutoArmor: "Smart",
  AutoRejoin: "Delay",
  LongJump: "Vanilla",
  AntiCheat: "Bypass",
  FastBreak: "Instant",
  AutoCraft: "Sword",
  AutoVote: "SkyWars",
  MusicFix: "Auto",
  Scaffold: "MultiBlock",
  Velocity: "Basic",
  InvWalk: "Normal",
  AntiBan: "Packet",
  Breaker: "Egg",
  Killaura: "Single",
  AntiFall: "Packet",
  Speed: "JumpSpeed",
  NoFall: "Desync",
  Phase: "Normal",
  Sprint: "Normal",
  Jesus: "Vanilla",
  Timer: "Boost",
  WTap: "Legit",
  Step: "Vanilla",
  ESP: "Box",
  Fly: "Desync",
  };

        // Draw logo (bottom-right)
        const logo = textureManager.vapeTexture.image;
        const scale = 0.9;
        const logoW = logo.width * scale;
        const logoH = logo.height * scale;
        const posX = canvasW - logoW - 15;
        const posY = canvasH - logoH - 15;

        ctx$5.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx$5.shadowBlur = 6;
        drawImage(ctx$5, logo, posX, posY, logoW, logoH);
        ctx$5.shadowColor = "transparent";
        ctx$5.shadowBlur = 0;

        let offset = 0;
        const stringList = [];

        for (const [module, value] of Object.entries(enabledModules)) {
            if (!value || module === "TextGUI") continue;
            stringList.push(module);
        }

        // Sort by width (desc)
        stringList.sort(
          (a, b) => ctx$5.measureText(b).width - ctx$5.measureText(a).width
        );

        // Draw modules on the right
        const paddingRight = 15;
        const startY = 27 + 10;

        for (const moduleName of stringList) {
            offset++;

            const fontStyle = \`\${textguisize[1]}px \${textguifont[1]}\`;
            ctx$5.font = fontStyle;

            // Build strings
            const rainbowText = moduleName;
            const modeText = moduleModes[moduleName] ? " - " + moduleModes[moduleName] : "";

            const fullText = rainbowText + modeText;
            const textWidth = ctx$5.measureText(fullText).width;
            const x = canvasW - textWidth - paddingRight;
            const y = startY + (textguisize[1] + 3) * offset;

            // Shadow for both parts
            ctx$5.shadowColor = "black";
            ctx$5.shadowBlur = 4;
            ctx$5.shadowOffsetX = 1;
            ctx$5.shadowOffsetY = 1;

            // Draw rainbow part
            drawText(
                ctx$5,
                rainbowText,
                x,
                y,
                fontStyle,
                \`hsl(\${((colorOffset - 0.025 * offset) % 1) * 360},100%,50%)\`,
                "left",
                "top",
                1,
                textguishadow[1]
            );

            // Draw grey mode part (after rainbow width)
            if (modeText) {
                const rainbowWidth = ctx$5.measureText(rainbowText).width;
                drawText(
                    ctx$5,
                    modeText,
                    x + rainbowWidth,
                    y,
                    fontStyle,
                    "#bbbbbb",
                    "left",
                    "top",
                    1,
                    textguishadow[1]
                );
            }

            // Reset shadow
            ctx$5.shadowColor = "transparent";
            ctx$5.shadowBlur = 0;
            ctx$5.shadowOffsetX = 0;
            ctx$5.shadowOffsetY = 0;
        }
    }
`
);
