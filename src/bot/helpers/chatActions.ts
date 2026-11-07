import { acquireChatLock, releaseChatLock } from "@/src/lib/redis";

/**
 * Memunculkan efek typing / upload media secara terus-menerus selama task berjalan.
 */
export async function runWithChatAction<T>(
	ctx: any,
	action: "typing" | "upload_photo" | "upload_document",
	task: () => Promise<T>,
): Promise<T> {
	await ctx.replyWithChatAction(action).catch(() => {});

	const interval = setInterval(() => {
		ctx.replyWithChatAction(action).catch(() => {});
	}, 4000);

	try {
		return await task();
	} finally {
		clearInterval(interval);
	}
}

/**
 * Wrapper untuk mengamankan 1 action per chat session menggunakan Lock Redis.
 */
export async function withSessionLock<T>(
	ctx: any,
	task: () => Promise<T>,
): Promise<T | void> {
	const chatId = ctx.chat?.id;
	if (!chatId) return task();

	const hasLock = await acquireChatLock(chatId);
	if (!hasLock) {
		return ctx.reply(
			"⏳ Mohon tunggu, bot sedang memproses pesan atau perintah Anda sebelumnya...",
		);
	}

	try {
		return await task();
	} finally {
		await releaseChatLock(chatId);
	}
}
