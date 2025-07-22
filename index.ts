// Import required modules from Deno-style sources
import {
  createBot,
  Intents,
  startBot,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { ensureArray } from "https://deno.land/std@0.224.0/bytes/mod.ts";

// Load environment variables from .env
config();

// Validate required variables
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const SHAPESINC_API_KEY = Deno.env.get("SHAPESINC_API_KEY")!;
const SHAPESINC_SHAPE_USERNAME = Deno.env.get("SHAPESINC_SHAPE_USERNAME")!;

if (!DISCORD_BOT_TOKEN || !SHAPESINC_API_KEY || !SHAPESINC_SHAPE_USERNAME) {
  console.error("❌ Missing required environment variables.");
  Deno.exit(1);
}

// Create Discord bot instance
const bot = createBot({
  token: DISCORD_BOT_TOKEN,
  intents:
    Intents.Guilds |
    Intents.GuildMessages |
    Intents.MessageContent |
    Intents.DirectMessages,
});

// On ready
bot.events.ready = (b, payload) => {
  b.id = payload.user.id;
  console.log(`🤖 Logged in as ${payload.user.username}`);

  // Set status if the library supports presence (Discordeno v19+, optional)
  // Not included in v18 — skip or upgrade if needed.
};

// Message handler
bot.events.messageCreate = async (b, message) => {
  if (message.isBot) return;

  const channel = await b.helpers.getChannel(message.channelId);
  const isDM = channel.type === 1n;
  const mentions = message.mentions?.map(m => m.id) ?? [];
  const isMentioned = mentions.includes(b.id);
  const isReply = message.referencedMessage?.authorId === b.id;

  if (!isDM && !isMentioned && !isReply) return;

  const content = isMentioned
    ? message.content.replace(/<@!?(\d+)>/, "").trim()
    : message.content;

  // Show typing
  try {
    await b.helpers.sendTyping(message.channelId);
  } catch {}

  try {
    const response = await fetch(
      "https://api.shapes.inc/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SHAPESINC_API_KEY}`,
          "Content-Type": "application/json",
          "X-User-Id": message.authorId.toString(),
          "X-Channel-Id": message.channelId.toString()
        },
        body: JSON.stringify({
          model: `shapesinc/${SHAPESINC_SHAPE_USERNAME}`,
          messages: [{ role: "user", content }],
        })
      }
    );

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "🤔 I couldn't think of a reply.";

    await b.helpers.sendMessage(message.channelId, { content: reply });
  } catch (err) {
    console.error("❌ Error:", err);
    await b.helpers.sendMessage(message.channelId, {
      content: `Sorry, I had a little hiccup ${isDM ? 'in your DMs' : 'in the server'}.`
    });
  }
};

// Start the bot
await startBot(bot);
