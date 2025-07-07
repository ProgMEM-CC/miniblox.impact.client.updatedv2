    addModification('this.entity.profile.username', `
(() => {
  const profile = this.entity?.profile;
  const username = profile?.username || "Player";

  if (!enabledModules["NameTags+"]) return username;

  const hp = this.entity.getHealth?.() || 0;
  const combatRank = profile?.stats?.rank || "wow!";

  return \`\${username} (\${combatRank}) ❤️ \${hp.toFixed(1)}\`;
})()
`, true);
