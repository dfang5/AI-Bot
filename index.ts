import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Dummy HTTP server to keep Deno Deploy happy
serve((req) => new Response("Fang Bot is alive!"));

// Start of Bot Code
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');
const axios = require('axios');

// Setup Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Register Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('network')
    .setDescription('Network utilities')
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Show ping and uptime.')
    )
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

// Bot Ready
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Handle Message Events
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.channel.type === ChannelType.DM) {
    return handleMessage(message);
  }

  const mentionedBot = message.mentions.has(client.user);
  const repliedToBot =
    message.reference &&
    (await message.fetchReference()).author.id === client.user.id;

  if (mentionedBot || repliedToBot) {
    return handleMessage(message, true);
  }
});

// Handle Slash Commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'network' && interaction.options.getSubcommand() === 'status') {
    const ping = client.ws.ping;
    const uptime = Math.floor(client.uptime / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;

    await interaction.reply({
      content: `📡 Ping: ${ping}ms\n⏱ Uptime: ${h}h ${m}m ${s}s`,
      ephemeral: true,
    });
  }
});

// Handle Message Logic
async function handleMessage(message, isServer = false) {
  const content = isServer
    ? message.content.replace(/<@!?(\d+)>/, '').trim()
    : message.content;

  try {
    await message.channel.sendTyping();

    const response = await axios.post(
      'https://api.shapes.inc/v1/chat/completions',
      {
        model: `shapesinc/${process.env.SHAPESINC_SHAPE_USERNAME}`,
        messages: [{ role: 'user', content }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHAPESINC_API_KEY}`,
          'X-User-Id': message.author.id,
          'X-Channel-Id': message.channel.id,
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    await message.reply(reply);
  } catch (err) {
    console.error(`❌ Error (${isServer ? 'Server' : 'DM'}):`, err.response?.data || err.message);
    await message.reply(
      `Sorry, I had a little hiccup ${isServer ? 'talking in the server' : 'in your DMs'}.`
    );
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
