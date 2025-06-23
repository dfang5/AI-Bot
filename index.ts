// index.ts

import { createBot, Intents, startBot, sendMessage, Message } from "https://deno.land/x/discordeno@18.0.1/mod.ts";

// ✅ Load environment variables
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
const SHAPESINC_API_KEY = Deno.env.get("SHAPESINC_API_KEY");
const SHAPESINC_SHAPE_USERNAME = Deno.env.get("SHAPESINC_SHAPE_USERNAME");

if (!DISCORD_BOT_TOKEN || !SHAPESINC_API_KEY || !SHAPESINC_SHAPE_USERNAME) {
  throw new Error("Missing required environment variables.");
}

// ✅ Create bot instance
const bot = createBot({
  token: DISCORD_BOT_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent | Intents.DirectMessages,
  botId: BigInt("0"), // Will be filled on ready
});

// ✅ Store bot ID on ready
bot.events.ready = (b, payload) => {
  b.id = payload.user.id;
  console.log(`🤖 Logged in as ${payload.user.username}`);
};

// ✅ Handle messages
bot.events.messageCreate = async (b, message) => {
  if (message.isBot) return;

  const channel = await b.helpers.getChannel(message.channelId);

  const isDM = channel.type === 1n;
  const isMentioned = message.mentions.some((m) => m.id === b.id);
  const isReply =
    message.referencedMessage &&
    message.referencedMessage.authorId === b.id;

  if (isDM || isMentioned || isReply) {
    const content = isMentioned
      ? message.content.replace(/<@!?(\d+)>/, "").trim()
      : message.content;

    // Show typing indicator
    try {
      await b.helpers.sendTyping(message.channelId);
    } catch {
      // Typing might not be available in some edge cases; ignore
    }

    try {
      const response = await fetch("https://api.shapes.inc/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SHAPESINC_API_KEY}`,
          "Content-Type": "application/json",
          "X-User-Id": message.authorId.toString(),
          "X-Channel-Id": message.channelId.toString()
        },
        body: JSON.stringify({
          model: `shapesinc/${SHAPESINC_SHAPE_USERNAME}`,
          messages: [{ role: "user", content }]
        })
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content ?? "No response received.";

      await sendMessage(b, message.channelId, { content: reply });
    } catch (err) {
      console.error(`❌ Error while replying:`, err);
      await sendMessage(b, message.channelId, {
        content: `Sorry, I had a hiccup trying to respond.`,
      });
    }
  }
};

// ✅ Start the bot
await startBot(bot);
