require("dotenv").config();
const { Client } = require("pg");
const { Telegraf } = require("telegraf");
const supabase = require("./config/supabaseClient");
const { endChat } = require("./commonFunctions");

const tokenFirstHalf = process.env.REACT_APP_BOT_TOKEN_FIRSTHALF;
const tokenSecondHalf = process.env.REACT_APP_BOT_TOKEN_SECONDHALF;
const token = tokenFirstHalf + ":" + tokenSecondHalf;

const bot = new Telegraf(token);

// Object to store client connections by userId
const clients = {};

function startDbListener(ctx, userId) {
  if (clients[userId]) {
    console.log(`Listener already started for userId ${userId}`);
    return;
  }

  const client = new Client({
    host: process.env.REACT_APP_DB_HOST,
    database: process.env.REACT_APP_DB_NAME,
    port: process.env.REACT_APP_DB_PORT,
    user: process.env.REACT_APP_DB_USER,
    password: process.env.REACT_APP_DB_PASSWORD,
  });

  client.connect();
  clients[userId] = client; // Track the client

  client.on("notification", (msg) => {
    (async () => {
      // Using an immediately invoked async function to handle async/await within the event handler
      try {
        const payload = JSON.parse(msg.payload);
        const messages = payload.messages;
        const receiverId = payload.id;

        if (Array.isArray(messages) && messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          console.log(
            "Last message received for:",
            receiverId,
            "is",
            lastMessage
          );
          if (lastMessage === "start_01_02_02_03") {
            notifyMatchFoundToUser(ctx);
          } else if (lastMessage === "bye_01_02_02_03") {
            await endChat(ctx); // Asynchronously call endChat
            notifyChatTerminationToUser(ctx); // Then notify user of chat termination
          } else {
            await sendMessageToUser(receiverId, lastMessage); // For regular messages
          }
        } else {
          console.log("No messages available or not an array.");
        }
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    })();
  });

  const channelName = `messages_updated_${userId}`;
  client.query(`LISTEN ${channelName}`);
  console.log(`Listening for notifications on "${channelName}"`);

  // Store the client in the clients object to manage it later
  clients[userId] = { client, channelName };
}

function stopDbListener(userId) {
  if (!clients[userId]) {
    console.log(`No active listener to stop for userId ${userId}`);
    return;
  }
  // Optionally, you could just UNLISTEN the specific channel if you plan to reuse the client
  // clients[userId].client.query(`UNLISTEN ${clients[userId].channelName}`);

  // Disconnect the client to clean up resources
  clients[userId].client.end();
  console.log(`Stopped listening for notifications for userId ${userId}`);

  // Remove the client from the tracking object
  delete clients[userId];
}

// Function to send a message to the user
async function sendMessageToUser(receiverId, message) {
  // Use bot.telegram.sendMessage to send a message to a specific chat ID
  try {
    await bot.telegram.sendMessage(receiverId, message);
    console.log(`Message sent to user ${receiverId}`);
  } catch (error) {
    console.error(`Failed to send message to user ${receiverId}:`, error);
  }
}

function notifyChatTerminationToUser(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["Start chat", "Edit profile", "Edit preferences"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  ctx.reply("Partner has left the chat.", keyboard);
}
function notifyMatchFoundToUser(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["End chat", "option 2", "option 3"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  ctx.reply("Match found. You can start chatting now.", keyboard);
}

module.exports = { startDbListener, stopDbListener };
