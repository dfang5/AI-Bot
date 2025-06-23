import {
  createBot,
  Intents,
  startBot,
  sendMessage,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

// ✅ Environment variables
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
const SHAPESINC_API_KEY = Deno.env.get("SHAPESINC_API_KEY");
const SHAPESINC_SHAPE_USERNAME = Deno.env.get("SHAPESINC_SHAPE_USERNAME");

if (!DISCORD_BOT_TOKEN || !SHAPESINC_API_KEY || !SHAPESINC_SHAPE_USERNAME) {
  throw new Error("Missing required environment variables.");
}

// ✅ Bot instance
const bot = createBot({
  token: DISCORD_BOT_TOKEN,
  botId: BigInt("0"),
  intents:
    Intents.Guilds |
    Intents.GuildMessages |
    Intents.DirectMessages |
    Intents.MessageContent,
});

// ✅ On ready
bot.events.ready = (b, payload) => {
  b.id = payload.user.id;
  console.log(`🤖 Logged in as ${payload.user.username}`);
};

// ✅ Message handler
bot.events.messageCreate = async (b, message) => {
  if (message.isBot) return;

  try {
    const channel = await b.helpers.getChannel(message.channelId);

    // ✅ More reliable DM check
    const isDM = channel.guildId === undefined;

    // ✅ Mention and reply fallback checks
    const mentions = message.mentions ?? [];
    const isMentioned = mentions.some((m) => m.id === b.id);
    const isReply =
      !!message.referencedMessage &&
      message.referencedMessage.authorId === b.id;

    console.log("📨 Message received:", {
      isDM,
      isMentioned,
      isReply,
      content: message.content,
    });

    // ✅ Only respond if DM or mentioned/replied
    if (!(isDM || isMentioned || isReply)) return;

    // 🕐 Typing indicator
    try {
      await b.helpers.sendTyping(message.channelId);
    } catch {
      console.warn("⚠️ Typing not supported in this channel.");
    }

    const userInput = isMentioned
      ? message.content.replace(/<@!?(\d+)>/, "").trim()
      : message.content;

    const response = await fetch("https://api.shapes.inc/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SHAPESINC_API_KEY}`,
        "Content-Type": "application/json",
        "X-User-Id": message.authorId.toString(),
        "X-Channel-Id": message.channelId.toString(),
      },
      body: JSON.stringify({
        model: `shapesinc/${SHAPESINC_SHAPE_USERNAME}`,
        messages: [{ role: "user", content: userInput }],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "No response received.";

    await sendMessage(b, message.channelId, { content: reply });
  } catch (err) {
    console.error("❌ Error while replying:", err);
    await sendMessage(b, message.channelId, {
      content: "Sorry, I had a hiccup trying to respond.",
    });
  }
};
    // 🔁 Send request to Shapes API
    const response = await fetch("https://api.shapes.inc/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SHAPESINC_API_KEY}`,
        "Content-Type": "application/json",
        "X-User-Id": message.authorId.toString(),
        "X-Channel-Id": message.channelId.toString(),
      },
      body: JSON.stringify({
        model: `shapesinc/${SHAPESINC_SHAPE_USERNAME}`,
        messages: [{ role: "user", content: userInput }],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "No response received.";

    await sendMessage(b, message.channelId, { content: reply });
  } catch (err) {
    console.error("❌ Message handler error:", err);
    await sendMessage(b, message.channelId, {
      content: "Sorry, I had a hiccup trying to respond.",
    });
  }
};

// ✅ Start the bot
await startBot(bot);
