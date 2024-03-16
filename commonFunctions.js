// userFunctions.js
const { Markup } = require("telegraf");
const { supabase } = require("./config/supabaseClient");
const emitter = require("./eventEmitter");

emitter.on("endChat", (ctx) => {
  endChat(ctx).catch((error) => console.error("Failed to end chat:", error));
});

async function endChat(ctx) {
  const chatId = ctx.message.chat.id.toString();

  // First, retrieve the current partner_id and gender
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("gender, partner_id")
    .eq("id", chatId)
    .single();

  if (fetchError) {
    console.log("Error fetching user data:", fetchError);
    return;
  }

  // Check if any data was returned
  if (!userData) {
    console.log("No user data found for id:", chatId);
    return;
  }

  // Extract gender and partner_id from the fetched data
  const { gender: userGender, partner_id: partnerId } = userData;

  // Now, update the user's messages, status, and partner_id to 0
  const { data, error } = await supabase
    .from("users")
    .update({ messages: [], status: "none", partner_id: 0 })
    .eq("id", chatId);

  if (error) {
    console.log("error ending chat session", error);
    return;
  }

  if (userGender) {
    await removeUserFromWaitingList(chatId, `${userGender}_waiting`);
  }
}

async function removeUserFromWaitingList(id, tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .delete()
    .match({ id: id });

  if (error) {
    console.error("Error deleting waiting list:", error);
    // return { success: false, message: error.message };
  }

  console.log("You have been removed from waiting list.");
  // return { success: true, data: data };
}

function onChatKeyboard(ctx, { msgCase }) {
  let replyText;
  if (msgCase === "new chat") {
    replyText = "Chat will start as soon as a match is found. Please wait!";
  } else if (msgCase === "on chat") {
    replyText =
      "You have already started a chat session, please end it before starting new.";
  } else {
    replyText = "Unknown case";
  }

  const keyboard = {
    reply_markup: {
      keyboard: [["End chat", "option 2", "option 3"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  return ctx.reply(replyText, keyboard);
}

function showOptionsKeyboard(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["Start chat", "Edit profile", "Edit preferences"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  return ctx.reply("What would you like to do next?", keyboard);
}
function waitingKeyboard(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["Cancel", "option 3", "option 4"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
  return ctx.reply("You are on waiting list for a match.", keyboard);
}

module.exports = {
  showOptionsKeyboard,
  onChatKeyboard,
  endChat,
  waitingKeyboard,
};
