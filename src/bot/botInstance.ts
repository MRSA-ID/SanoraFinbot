import { Bot } from "grammy";
import {
	handleStartCommand,
	triggerManualSync,
	handleSettingsCommand,
	handleDisconnectCommand,
	handleDeleteAccountCommand,
} from "./handlers/commands";
import { handleCallbackQuery } from "./handlers/callbacks";
import { handleIncomingMessage } from "./handlers/messages";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Register Commands
bot.command("start", handleStartCommand);
bot.command("sync", triggerManualSync);
bot.command("settings", handleSettingsCommand);
bot.command("disconnect", handleDisconnectCommand);
bot.command("deleteaccount", handleDeleteAccountCommand);

// Register Callback Queries (Buttons)
bot.on("callback_query:data", handleCallbackQuery);

// Register Message Handler
bot.on("message", handleIncomingMessage);

export { bot };
