require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL']
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ✅ Handle DMs (Direct Messages)
  if (message.channel.type === 1) {
    const content = message.content;

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
      return message.reply(reply);
    } catch (err) {
      console.error('Error from Shapes API (DM):', err.response?.data || err.message);
      return message.reply("Sorry, I had a little hiccup in your DMs.");
    }
  }

  // ✅ Handle Server messages with mention or reply
  const mentionedBot = message.mentions.has(client.user);
  const repliedToBot =
    message.reference &&
    (await message.fetchReference()).author.id === client.user.id;

  if (mentionedBot || repliedToBot) {
    const content = mentionedBot
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
      message.reply(reply);
    } catch (err) {
      console.error('Error from Shapes API (Server):', err.response?.data || err.message);
      message.reply("Sorry, I had a little hiccup talking in the server.");
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
