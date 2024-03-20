const { Telegraf } = require("telegraf");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { startKeyboard } = require("./keyboards");

const app = express();
const port = process.env.PORT || 3000; // Use the port that suits your deployment environment

const {
  greetUser,
  checkChatEligibility,
  handleText,
  endChat,
  // subscribeToMessages,
} = require("./userFunctions");

const tokenFirsthalf = process.env.REACT_APP_BOT_TOKEN_FIRSTHALF;
const tokenSecondhalf = process.env.REACT_APP_BOT_TOKEN_SECONDHALF;
const token = tokenFirsthalf + ":" + tokenSecondhalf;

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
  let shouldHandleText = false;

  if (text === "/start") {
    ctx.reply("Starting");
  } else if (text === "Start chat") {
    shouldHandleText = await checkChatEligibility(ctx);
  } else if (text === "End chat") {
    await endChat(ctx);
  } else if (text === "Cancel") {
    await endChat(ctx);
  } else {
    shouldHandleText = true;
  }

  if (shouldHandleText) {
    await handleText(text, ctx);
  }
});

bot.on("message", async (ctx) => {
  // Check if the message includes web_app_data
  if (ctx.message?.web_app_data) {
    // Extract the data sent from the web app
    const dataString = ctx.message.web_app_data.data;

    // Attempt to parse the dataString as JSON
    try {
      const data = JSON.parse(dataString);
      // Log the parsed JSON data for debugging
      console.log("Received JSON data from web app:", data);

      // Respond to the user based on the received data
      const keyboard = startKeyboard(ctx);
      switch (data.action) {
        case "registration_successful":
          await ctx.reply(
            "Registration successful. Click on start to find a match.",
            keyboard
          );
          break;
        case "profile_edit_successful":
          await ctx.reply(
            "Profile updated seccesfully. You can continue to find a match.",
            keyboard
          );
          break;
        case "preference_edit_successful":
          await ctx.reply(
            "Preference updated seccesfully. You can continue to find a match.",
            keyboard
          );
          break;

        // Add cases for other actions here

        default:
          console.log("Unknown action received from web app");
          await ctx.reply("Received an unknown command from the web app.");
      }
    } catch (error) {
      // If parsing fails, log the error and treat it as plaintext
      console.error("Error parsing data from web app:", error);
      // Optionally, respond back acknowledging the plaintext data
      await ctx.reply(
        "Received your message, but I couldn't understand it. Please try again."
      );
    }
  } else {
    // Handle other messages that don't include web_app_data
    console.log("Received a regular message: ", ctx.message.text);
    // Optionally, provide a default response or guidance
    await ctx.reply("How can I assist you today?");
  }
});

bot.on("error", (error) => {
  console.error(error);
});

// // Express route for follow-up actions
// app.post("/follow-up", async (req, res) => {
//   const { chatId, message } = req.body;
//   console.log("there is follow up", message);
//   if (message && chatId) {
//     const keyboard = startKeyboard();
//     bot.telegram.sendMessage(chatId, ".", keyboard);
//   }
//   try {
//     await bot.telegram.sendMessage(chatId, message);
//     res
//       .status(200)
//       .send({ success: true, message: "Follow-up message sent successfully." });
//   } catch (error) {
//     console.error("Error sending follow-up message:", error);
//     res
//       .status(500)
//       .send({ success: false, message: "Error sending follow-up message." });
//   }
// });

// // Start Express server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

// Make sure to gracefully handle shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
