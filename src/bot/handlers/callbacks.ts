import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { triggerManualSync } from "./commands";
import {
	renderRegisteredStartMessage,
	renderSettingsMessage,
	getRangeLabel,
	escapeHtml,
} from "../helpers/formatters";

export async function handleCallbackQuery(ctx: any) {
	const data = ctx.callbackQuery.data;
	const chatId = ctx.chat?.id;
	const firstName = ctx.from?.first_name || ctx.from?.username || "Pengguna";

	if (data === "action_sync_now") {
		await ctx.answerCallbackQuery({ text: "Memulai pemindaian Gmail..." });
		await triggerManualSync(ctx);
		return;
	}

	if (data === "action_open_settings") {
		await ctx.answerCallbackQuery();
		const { data: user } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (user) {
			const { text, keyboard } = renderSettingsMessage(user);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}

	if (data === "action_back_home") {
		await ctx.answerCallbackQuery();
		const { data: user } = await supabaseAdmin
			.from("users")
			.select(
				"google_email, spreadsheet_id, gmail_sync_enabled, sync_range_days, refresh_token",
			)
			.eq("telegram_chat_id", chatId)
			.single();

		if (user && user.refresh_token) {
			const { text, keyboard } = renderRegisteredStartMessage(user, firstName);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		} else {
			const authLink = `${process.env.APP_URL}/api/auth/google?chat_id=${chatId}`;
			await ctx.editMessageText(
				`Selamat datang di <b>Sanora Finance AI Bot</b>, <b>${escapeHtml(firstName)}</b>!\n\n💡 <b>Mode Guest (Uji Coba Langsung):</b> Anda dapat langsung mengirim teks, foto, atau file mutasi.\n\n🔗 <a href="${authLink}">Hubungkan Akun Google</a>`,
				{ parse_mode: "HTML" },
			);
		}
		return;
	}

	if (data === "action_confirm_disconnect") {
		await ctx.answerCallbackQuery();
		await supabaseAdmin
			.from("users")
			.update({
				google_email: null,
				refresh_token: null,
				spreadsheet_id: null,
				gmail_sync_enabled: false,
			})
			.eq("telegram_chat_id", chatId);

		await ctx.editMessageText(
			`🔌 <b>Koneksi Google Diberhentikan!</b>\n\nAkun Anda telah dikembalikan ke <b>Mode Guest</b>. Ketik /start jika ingin menghubungkan kembali.`,
			{ parse_mode: "HTML" },
		);
		return;
	}

	if (data === "action_confirm_delete") {
		await ctx.answerCallbackQuery();
		await supabaseAdmin.from("users").delete().eq("telegram_chat_id", chatId);
		await ctx.editMessageText(
			`🗑️ <b>Data Akun Berhasil Dihapus!</b>\n\nSeluruh preferensi Anda di database telah dibersihkan.`,
			{ parse_mode: "HTML" },
		);
		return;
	}

	if (data.startsWith("toggle_sync:")) {
		const isEnabled = data.split(":")[1] === "on";
		await supabaseAdmin
			.from("users")
			.update({ gmail_sync_enabled: isEnabled })
			.eq("telegram_chat_id", chatId);

		await ctx.answerCallbackQuery({
			text: isEnabled ? "🟢 Auto-sync Diaktifkan!" : "🔴 Auto-sync Dimatikan!",
		});

		const { data: updatedUser } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (updatedUser) {
			const { text, keyboard } = renderSettingsMessage(updatedUser);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}

	if (data.startsWith("set_range:")) {
		const days = parseInt(data.split(":")[1], 10);
		await supabaseAdmin
			.from("users")
			.update({ sync_range_days: days })
			.eq("telegram_chat_id", chatId);

		await ctx.answerCallbackQuery({
			text: `Rentang pindai diubah ke ${getRangeLabel(days)}!`,
		});

		const { data: updatedUser } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (updatedUser) {
			const { text, keyboard } = renderSettingsMessage(updatedUser);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}
}
