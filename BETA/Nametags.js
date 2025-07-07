    addModification('this.entity.profile.username', `
(() => {
  const profile = this.entity?.profile;
  const username = profile?.username || "Player";

  if (!enabledModules["NameTags+"]) return username;

  const hp = this.entity.getHealth?.() || 0;
  const combatRank = profile?.stats?.rank || "fr";

  const color = hp > 15 ? "§a" : hp > 7 ? "§e" : "§c";

  const px = player?.pos?.x ?? 0;
  const py = player?.pos?.y ?? 0;
  const pz = player?.pos?.z ?? 0;
  const ex = this.entity?.pos?.x ?? 0;
  const ey = this.entity?.pos?.y ?? 0;
  const ez = this.entity?.pos?.z ?? 0;

  const dx = px - ex;
  const dy = py - ey;
  const dz = pz - ez;

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const distStr = dist.toFixed(1) + "m";

  return \`\${username} (\${combatRank}) ❤️ \${color}\${hp.toFixed(1)} [\${distStr}]\`;
})()
`, true);
