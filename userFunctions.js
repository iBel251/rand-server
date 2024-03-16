// userFunctions.js
const { Markup } = require("telegraf");
const { supabase } = require("./config/supabaseClient");
const { startDbListener, stopDbListener } = require("./dbListener");

async function greetUser(ctx) {
  const chatId = ctx.message.chat.id.toString();
  const senderData = ctx.message.from;
  const name = senderData.first_name;
  const userData = {
    status: "none",
    is_registered: false,
    sender_data: senderData,
    balance: 100,
    verified: false,
    strike: 0,
    gender: "not set",
    age: null,
    city: "not set",
    preferences: {
      gender: "not set",
      age: null,
      city: "not set",
    },
    messages: [],
  };

  const { data, error } = await supabase
    .from("users")
    .select()
    .eq("id", chatId)
    .single();

  if (error) {
    console.error("Error fetching user:", error.message);
  }

  // If user doesn't exist, register the user
  if (!data) {
    // Save user data to Supabase
    const { error: saveError } = await supabase
      .from("users")
      .insert([{ id: chatId, ...userData }]);

    if (saveError) {
      console.error("Error registering user:", saveError.message);
      return;
    }
    const message = `Wellcome ${name}! Please click on the button and fill out the one time registration form.`;
    console.log("New user registered:", userData);
    sendRegisterButton(ctx, message);
  }
  if (data.is_registered === true) {
    if (data.status === "on chat") {
      onChatKeyboard(ctx, { msgCase: "on chat" });
    } else if (data.status === "waiting") {
      waitingKeyboard(ctx);
    } else {
      showOptionsKeyboard(ctx);
    }

    console.log("User already exists:", data);
  } else if (data.is_registered === false) {
    const message =
      "Registration not complete, please follow the link and fill out a quick form.";
    sendRegisterButton(ctx, message);
  }
}
async function checkChatEligibility(ctx) {
  const chatId = ctx.message.chat.id.toString();
  startDbListener(ctx, chatId);
  const { data, error } = await supabase
    .from("users")
    .select()
    .eq("id", chatId)
    .single();

  if (error) {
    console.log("error fetching user by id", error);
  }
  if (!data) {
    console.log("no user found");
  }
  if (data) {
    const preferedGender = data.preferences.gender || null;
    if (data.is_registered === false) {
      const message =
        "Registration not complete, please follow the link and fill out a quick form.";
      console.log("user not fully registered, please finish registration");
      sendRegisterButton(ctx, message);
    } else if (data.status === "on chat") {
      onChatKeyboard(ctx);
    } else if (data.status === "waiting") {
      waitingKeyboard(ctx);
    } else if (data.is_registered === true && data.status === "none") {
      console.log("u r eligible to chat");
      startChat(ctx, preferedGender, data.gender);
    } else {
      console.log("sorry didnt catch this one.");
    }
  }
}

async function startChat(ctx, preferedGender, gender) {
  const chatId = ctx.message.chat.id;

  const { data, error } = await supabase.rpc(
    `update_${preferedGender}_status_and_get_id`,
    {
      your_chat_id: chatId,
    }
  );

  if (error) {
    console.error(error);
  }
  if (data) {
    const partnerId = data;
    await linkPartners(chatId, partnerId);
    console.log(`Updated row with id ${partnerId}`);
    await updateUserStatus(chatId, "on chat");
    onChatKeyboard(ctx, { msgCase: "new chat" });
  }
  if (!data) {
    console.log("Waiting for matches...");
    await updateUserStatus(chatId, "waiting");
    await putUserOnWaitingList(ctx, chatId, gender);
  }
}

async function handleText(text, ctx) {
  const chatId = ctx.message.chat.id.toString();
  const { data, error } = await supabase
    .from("users")
    .select()
    .eq("id", chatId)
    .single();

  if (error) {
    console.log("error fetching user by id", error);
  }
  if (!data) {
    console.log("no user found");
  }
  if (data) {
    const partnerId = data.partner_id || 0;
    if (data.status === "on chat") {
      console.log(`since you are sending this text:(${text}) to ${partnerId}`);
      // Perform the update operation to add the new value to the text array
      await sendMessageToPartner(partnerId, text);
    } else {
      return ctx.reply(
        "Invalid command, please use the keyboard below or press /start"
      );
    }
  }
}

async function sendMessageToPartner(partnerId, text) {
  const { data, error } = await supabase.rpc("append_message_to_user", {
    user_id_param: partnerId,
    message_text: text,
  });

  // Handle update error
  if (error) {
    console.error("Error updating array column:", error.message);
    return;
  }
}

async function endChat(ctx) {
  const chatId = ctx.message.chat.id.toString();
  stopDbListener(ctx, chatId);

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
  if (partnerId) await sendMessageToPartner(partnerId, "bye_01_02_02_03");
  showOptionsKeyboard(ctx);
}

async function linkPartners(userId, partnerId) {
  // Begin a transaction
  const { data, error } = await supabase.rpc("link_users", {
    user_id_param: userId,
    partner_id_param: partnerId,
  });

  if (error) {
    console.error("Error linking users:", error);
    return false;
  }
  await sendMessageToPartner(partnerId, "start_01_02_02_03");
  console.log("Users linked successfully:", data);
  return true;
}

async function putUserOnWaitingList(ctx, id, gender) {
  console.log("putting user on waiting :", id, gender);

  const { data, error } = await supabase
    .from(`${gender}_waiting`)
    .upsert({ id: id, status: "waiting" }, { onConflict: "id" });

  if (error) {
    console.log("Error putting user on waiting list:", error.message);
  } else {
    waitingKeyboard(ctx);
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

async function updateUserStatus(id, status) {
  const { error: updateError } = await supabase
    .from("users")
    .update({ status: status })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating status:", updateError.message);
    return;
  }
  console.log("user status updated : ", status);
}

function sendRegisterButton(ctx, message) {
  const chatId = ctx.message.chat.id.toString();

  // The URL of your web application
  const webAppUrl = `https://randtalk-dof1.onrender.com/${chatId}`;

  // Inline keyboard markup
  const inlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Register", // Button text
          web_app: { url: webAppUrl }, // Button action: open your web app
        },
      ],
    ],
  };

  // Use the `sendMessage` method with the inline keyboard markup
  ctx.telegram
    .sendMessage(ctx.chat.id, message, {
      reply_markup: inlineKeyboardMarkup,
    })
    .then(() => {
      console.log("Message with web app button sent successfully.");
    })
    .catch((error) => {
      console.error("Failed to send message with web app button:", error);
    });
  const keyboard = {
    reply_markup: {
      keyboard: [["/start"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  return ctx.reply("RandTalkET", keyboard);
}

function onChatKeyboard(ctx, { msgCase }) {
  let replyText;
  if (msgCase === "new chat") {
    replyText = "Match found. You can start chatting now.";
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
      one_time_keyboard: false,
    },
  };

  return ctx.reply(replyText, keyboard);
}

function showOptionsKeyboard(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["Start chat", "Edit profile", "Edit preferences"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  return ctx.reply("What would you like to do next?", keyboard);
}
function waitingKeyboard(ctx) {
  const keyboard = {
    reply_markup: {
      keyboard: [["Cancel", "option 3", "option 4"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  return ctx.reply("You are on waiting list for a match.", keyboard);
}

module.exports = {
  greetUser,
  showOptionsKeyboard,
  checkChatEligibility,
  startChat,
  handleText,
  onChatKeyboard,
  endChat,
  // subscribeToMessages,
};
