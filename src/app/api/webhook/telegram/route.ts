import { webhookCallback } from "grammy";
import { bot } from "@/src/bot/botInstance";

export const runtime = "nodejs";

export const POST = webhookCallback(bot, "std/http");
