import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
	title: "Sanora Finance AI Bot",
	description: "Automated Finance Assistant",
	manifest: "/manifest.webmanifest",
	icons: {
		icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png" }],
		apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
	},
};

export const viewport: Viewport = {
	themeColor: "#0284c7",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="id">
			<body>{children}</body>
		</html>
	);
}
