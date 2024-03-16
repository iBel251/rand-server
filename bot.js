const { db } = require("./firebase");
const { Telegraf } = require("telegraf");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const supabase = require("./config/supabaseClient");
const { Client } = require("pg");
const startDbListener = require("./dbListener");

const app = express();
const port = process.env.PORT || 3000; // Use the port that suits your deployment environment

const {
  greetUser,
  checkChatEligibility,
  handleText,
  endChat,
  showOptionsKeyboard,
  // subscribeToMessages,
} = require("./userFunctions");

const token = "6389919920:AAGtICZ4LdgQjG31BHGz2fL-fbCEDtoulf8";

const bot = new Telegraf(token);

// Middlewares
app.use(bodyParser.json()); // to support JSON-encoded bodies
// Enable All CORS Requests for development use
app.use(
  cors({
    origin: [
      "https://randtalk-dof1.onrender.com",
      "http://localhost:3001",
      "http://localhost:3000",
      "https://web.telegram.org",
    ], // Allow your web app's origin
  })
);

bot.launch().then(() => {
  console.log("Bot started");
});

bot.start(async (ctx) => {
  const chatId = ctx.message.chat.id;
  await greetUser(ctx);
});

bot.on("text", async (ctx) => {
  const chatId = ctx.message.chat.id.toString();
  const text = ctx.message.text;
  // const userRef = doc(db, "users", chatId);
  // const docSnap = await getDoc(userRef);

  if (text === "/start") {
    ctx.reply("Starting");
  } else if (text === "Start chat") {
    await checkChatEligibility(ctx);
    // ctx.reply("checking ability to chat");
  } else if (text === "Edit profile") {
    ctx.reply("opening edit webapp");
  } else if (text === "Edit preferences") {
    ctx.reply("opening preferences webapp");
  } else if (text === "End chat") {
    await endChat(ctx);
  } else if (text === "Cancel") {
    await endChat(ctx);
  } else {
    await handleText(text, ctx);
  }
});

bot.on("error", (error) => {
  console.error(error);
});

// Express route for follow-up actions
app.post("/follow-up", async (req, res) => {
  const { chatId, message } = req.body;
  console.log("there is follow up", message);
  if (message && chatId) {
    const keyboard = {
      reply_markup: {
        keyboard: [["Start chat", "Edit profile", "Edit preferences"]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };
    bot.telegram.sendMessage(chatId, ".", keyboard);
  }
  try {
    await bot.telegram.sendMessage(chatId, message);
    res
      .status(200)
      .send({ success: true, message: "Follow-up message sent successfully." });
  } catch (error) {
    console.error("Error sending follow-up message:", error);
    res
      .status(500)
      .send({ success: false, message: "Error sending follow-up message." });
  }
});

// Start Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Make sure to gracefully handle shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
