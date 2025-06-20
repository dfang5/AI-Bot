require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel] // Required to receive DMs
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // 📩 If message is a Direct Message
  if (message.channel.type === ChannelType.DM) {
    return handleMessage(message);
  }

  // 🏷 If mentioned or replied to in a server
  const mentionedBot = message.mentions.has(client.user);
  const repliedToBot =
    message.reference &&
    (await message.fetchReference()).author.id === client.user.id;

  if (mentionedBot || repliedToBot) {
    return handleMessage(message, true);
  }
});

// 🔁 Centralized message handler
async function handleMessage(message, isServer = false) {
  const content = isServer
    ? message.content.replace(/<@!?(\d+)>/, '').trim()
    : message.content;

  try {
    const response = await axios.post(
      'https://api.shapes.inc/v1/chat/completions',
      {
        model: `shapesinc/${process.env.SHAPESINC_SHAPE_USERNAME}`,
        messages: [{ role: 'user', content }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHAPESINC_API_KEY}`,
          'X-User-Id': message.author.id,
          'X-Channel-Id': message.channel.id
        }
      }
    );

    const reply = response.data.choices[0].message.content;
    await message.reply(reply);
  } catch (err) {
    console.error(
      `❌ Error from the bot syntax (${isServer ? 'Server' : 'DM'}):`,
      err.response?.data || err.message
    );
    await message.reply(
      `Sorry, I had a little hiccup ${isServer ? 'talking in the server' : 'in your DMs'}.`
    );
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
