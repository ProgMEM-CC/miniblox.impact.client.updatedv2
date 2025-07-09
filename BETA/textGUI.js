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

addModification('(this.drawSelectedItemStack(),this.drawHintBox())', /*js*/`
    if (ctx$5 && enabledModules["TextGUI"]) {
        const colorOffset = Date.now() / 4000;
        const posX = 15;
        const posY = 27;

        ctx$5.imageSmoothingEnabled = true;
        ctx$5.imageSmoothingQuality = "high";

        // Scale logo properly
        const logo = textureManager.vapeTexture.image;
        const scale = 0.25;
        const logoW = logo.width * scale;
        const logoH = logo.height * scale;

        // Optional: subtle logo shadow
        ctx$5.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx$5.shadowBlur = 6;
        drawImage(ctx$5, logo, posX, posY, logoW, logoH);
        ctx$5.shadowColor = "transparent";
        ctx$5.shadowBlur = 0;

        // Draw v4 badge beside logo
        drawImage(
            ctx$5,
            textureManager.v4Texture.image,
            posX + logoW + 5,
            posY + 1,
            33,
            18
        );

        let offset = 0;
        let stringList = [];

        for (const [module, value] of Object.entries(enabledModules)) {
            if (!value || module === "TextGUI") continue;
            stringList.push(module);
        }

        // Sort by width (desc)
        stringList.sort(
            (a, b) => ctx$5.measureText(b).width - ctx$5.measureText(a).width
        );

        // Start text below the logo
        const startY = posY + logoH + 10;

        for (const module of stringList) {
            offset++;

            // Clean glow/shadow effect
            ctx$5.shadowColor = "black";
            ctx$5.shadowBlur = 4;
            ctx$5.shadowOffsetX = 1;
            ctx$5.shadowOffsetY = 1;

            drawText(
                ctx$5,
                module,
                posX + 6,
                startY + ((textguisize[1] + 3) * offset),
                textguisize[1] + "px " + textguifont[1],
                \`HSL(\${((colorOffset - (0.025 * offset)) % 1) * 360}, 100%, 50%)\`,
                "left",
                "top",
                1,
                textguishadow[1]
            );

            // Reset shadow after each line
            ctx$5.shadowColor = "transparent";
            ctx$5.shadowBlur = 0;
            ctx$5.shadowOffsetX = 0;
            ctx$5.shadowOffsetY = 0;
        }
    }
`);
