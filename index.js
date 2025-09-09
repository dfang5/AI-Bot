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

// Extract User Context from Message
async function extractUserContext(message) {
  const userContext = [];
  
  // Add the message author
  userContext.push({
    id: message.author.id,
    username: message.author.username,
    displayName: message.author.displayName || message.author.username,
    globalName: message.author.globalName || message.author.username,
    isAuthor: true
  });

  // Extract mentioned users
  if (message.mentions.users.size > 0) {
    for (const [userId, user] of message.mentions.users) {
      if (userId !== message.author.id) { // Don't duplicate the author
        let displayName = user.displayName || user.username;
        let globalName = user.globalName || user.username;
        
        // If in a server, try to get the member's nickname
        if (message.guild) {
          try {
            const member = await message.guild.members.fetch(userId);
            displayName = member.displayName || member.nickname || user.username;
          } catch (err) {
            console.log(`Could not fetch member ${userId}:`, err.message);
          }
        }
        
        userContext.push({
          id: userId,
          username: user.username,
          displayName: displayName,
          globalName: globalName,
          isAuthor: false
        });
      }
    }
  }

  // If replying to someone, add the referenced user
  if (message.reference) {
    try {
      const referencedMessage = await message.fetchReference();
      const referencedUser = referencedMessage.author;
      
      // Check if this user is not already in our context
      if (!userContext.find(u => u.id === referencedUser.id)) {
        let displayName = referencedUser.displayName || referencedUser.username;
        let globalName = referencedUser.globalName || referencedUser.username;
        
        if (message.guild) {
          try {
            const member = await message.guild.members.fetch(referencedUser.id);
            displayName = member.displayName || member.nickname || referencedUser.username;
          } catch (err) {
            console.log(`Could not fetch referenced member ${referencedUser.id}:`, err.message);
          }
        }
        
        userContext.push({
          id: referencedUser.id,
          username: referencedUser.username,
          displayName: displayName,
          globalName: globalName,
          isAuthor: false,
          isReferenced: true
        });
      }
    } catch (err) {
      console.log('Could not fetch referenced message:', err.message);
    }
  }

  return userContext;
}

// Handle Message Logic
async function handleMessage(message, isServer = false) {
  const content = isServer
    ? message.content.replace(/<@!?(\d+)>/, '').trim()
    : message.content;

  try {
    await message.channel.sendTyping();

    // Extract user context from the message
    const userContext = await extractUserContext(message);
    
    // Create a user context string to help the AI understand who is who
    const userContextString = userContext.map(user => {
      let contextStr = `User ${user.username}`;
      if (user.displayName !== user.username) {
        contextStr += ` (display name: ${user.displayName})`;
      }
      if (user.globalName !== user.username) {
        contextStr += ` (global name: ${user.globalName})`;
      }
      contextStr += ` [ID: ${user.id}]`;
      if (user.isAuthor) contextStr += ' (message author)';
      if (user.isReferenced) contextStr += ' (replied to)';
      return contextStr;
    }).join(', ');

    // Enhanced message content with user context
    const enhancedContent = userContext.length > 1 
      ? `[User Context: ${userContextString}]\n\nMessage: ${content}`
      : content;

    const response = await axios.post(
      'https://api.shapes.inc/v1/chat/completions',
      {
        model: `shapesinc/${process.env.SHAPESINC_SHAPE_USERNAME}`,
        messages: [{ role: 'user', content: enhancedContent }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHAPESINC_API_KEY}`,
          'X-User-Id': message.author.id,
          'X-Channel-Id': message.channel.id,
          'X-User-Context': JSON.stringify(userContext),
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
