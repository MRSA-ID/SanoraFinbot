import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const chatId = searchParams.get("chat_id");

	if (!chatId) {
		return NextResponse.json(
			{ error: "Missing chat_id parameter" },
			{ status: 400 },
		);
	}

	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI,
	);

	const scopes = [
		"https://www.googleapis.com/auth/gmail.readonly",
		"https://www.googleapis.com/auth/spreadsheets",
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/userinfo.email",
	];

	const authUrl = oauth2Client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: scopes,
		state: chatId, // Membawa telegram_chat_id ke proses callback
	});

	return NextResponse.redirect(authUrl);
}
