    // === IMPROVED TARGETHUD CODE (no delay, gradient bar, rounded box :D) ===
    if (
      ctx$5 &&
      enabledModules["TargetHUD"] &&
      typeof game !== "undefined" &&
      game.world &&
      game.world.entitiesDump &&
      typeof player !== "undefined" &&
      player.id
    ) {
        let nearest = null;
        let minDist = Infinity;
        const maxRange = 7; // How close to the player it is. (ie. HUD shows when player is 7 blocks away)

        for (const entity of game.world.entitiesDump?.values?.() || []) {
            if (!entity || !entity.name || entity.id == player.id) continue;
            if (typeof entity.getHealth !== "function") continue;
            const dist = player.pos.distanceTo(entity.pos);
            if (dist < minDist) {
                minDist = dist;
                nearest = entity;
            }
        }

        if (nearest && minDist <= maxRange) {
            // Rounded box with padding and shadow
            const w = 300, h = 120, r = 16; // width, height, radius
            const canvasW = ctx$5.canvas.width;
            const canvasH = ctx$5.canvas.height;
            const x = Math.floor((canvasW - w) / 2);
            const y = Math.floor(canvasH * 0.15);

            ctx$5.save();
            // Shadow
            ctx$5.shadowColor = "rgba(0,0,0,0.7)";
            ctx$5.shadowBlur = 12;
            // Rounded rectangle
            ctx$5.beginPath();
            ctx$5.moveTo(x + r, y);
            ctx$5.lineTo(x + w - r, y);
            ctx$5.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx$5.lineTo(x + w, y + h - r);
            ctx$5.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx$5.lineTo(x + r, y + h);
            ctx$5.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx$5.lineTo(x, y + r);
            ctx$5.quadraticCurveTo(x, y, x + r, y);
            ctx$5.closePath();
            ctx$5.fillStyle = "#000";
            ctx$5.globalAlpha = 0.85;
            ctx$5.fill();
            ctx$5.globalAlpha = 1.0;
            ctx$5.strokeStyle = "#00aaff";
            ctx$5.lineWidth = 2;
            ctx$5.stroke();
            ctx$5.shadowColor = "transparent";
            ctx$5.shadowBlur = 0;

            ctx$5.textAlign = "center";

            // Name (top)
            ctx$5.font = "bold 15px Poppins";
            ctx$5.fillStyle = "#fff";
            ctx$5.fillText(nearest.name, x + w/2, y + 38);

            // Health bar (gradient)
            const maxHealth = nearest.getMaxHealth ? nearest.getMaxHealth() : 20;
            const health = Math.max(0, Math.min(maxHealth, nearest.getHealth()));
            const barW = 180, barH = 18, barX = x + (w-barW)/2, barY = y + 52;
            const barFill = barW * (health / maxHealth);

            // Gradient: green (left) -> yellow (middle) -> red (right)
            const grad = ctx$5.createLinearGradient(barX, 0, barX + barW, 0);
            grad.addColorStop(0, "#2ecc71");
            grad.addColorStop(0.5, "#f1c40f");
            grad.addColorStop(1, "#e74c3c");
            ctx$5.fillStyle = "#444";
            ctx$5.fillRect(barX, barY, barW, barH);
            ctx$5.fillStyle = grad;
            ctx$5.fillRect(barX, barY, barFill, barH);

            // Health text (below health bar)
            ctx$5.font = "bold 15px Poppins";
            ctx$5.fillStyle = "#fff";
            ctx$5.fillText(Math.round(health) + " HP", x + w/2, barY + barH + 24);

            // Distance (bottom)
            ctx$5.font = "15px Poppins";
            ctx$5.fillStyle = "#00aaff";
            ctx$5.fillText(minDist.toFixed(1) + "m", x + w/2, y + h - 16);

            ctx$5.restore();
        }
    }
  `
);
