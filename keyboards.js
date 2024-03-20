function startKeyboard(ctx) {
  const chatId = ctx.message.chat.id.toString();
  const userEditUrl = `https://randtalk-dof1.onrender.com/edituser/${chatId}`;
  const preferenceEditUrl = `https://randtalk-dof1.onrender.com/editpreference/${chatId}`;

  const keyboard = {
    reply_markup: {
      keyboard: [
        [
          "Start chat",
          { text: "Edit profile", web_app: { url: userEditUrl } },
          { text: "Edit preferences", web_app: { url: preferenceEditUrl } },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };

  return keyboard;
}

module.exports = { startKeyboard };
