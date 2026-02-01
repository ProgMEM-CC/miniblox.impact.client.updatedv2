//dont touch this
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const express = require("express");

/**
 * CONFIG (LOCAL ONLY)
 */
const DISCORD_TOKEN = "YOUR_BOT_TOKEN_HERE";
const ADMIN_API_KEY = "SUPER_SECRET_KEY";
const PORT = 3000;

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);

/**
 * Helper: admin check
 */
async function isAdmin(guild, userId) {
  const member = await guild.members.fetch(userId);
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

/**
 * POST /send
 * Sends a message to a channel (can trigger other bots)
 */
app.post("/send", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== ADMIN_API_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { guild_id, channel_id, commandtoexecor, discord_user_id } = req.body;

    if (!guild_id || !channel_id || !commandtoexecor || !discord_user_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const guild = await client.guilds.fetch(guild_id);

    if (!(await isAdmin(guild, discord_user_id))) {
      return res.status(403).json({ error: "User is not an administrator" });
    }

    const channel = await guild.channels.fetch(channel_id);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: "Invalid channel" });
    }

    await channel.send(commandtoexecor);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /setrole
 * Assigns a role by name to a user
 */
app.post("/setrole", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== ADMIN_API_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const {
      guild_id,
      role,
      user,
      discord_user_id
    } = req.body;

    if (!guild_id || !role || !user || !discord_user_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const guild = await client.guilds.fetch(guild_id);

    if (!(await isAdmin(guild, discord_user_id))) {
      return res.status(403).json({ error: "User is not an administrator" });
    }

    const member = await guild.members.fetch(user);

    const roleObj = guild.roles.cache.find(
      r => r.name.toLowerCase() === role.toLowerCase()
    );

    if (!roleObj) {
      return res.status(404).json({ error: "Role not found" });
    }

    await member.roles.add(roleObj);

    res.json({
      success: true,
      assigned_role: roleObj.name,
      user: member.user.tag
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});
