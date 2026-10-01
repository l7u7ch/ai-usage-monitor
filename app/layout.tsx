import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionActivity } from "@/components/session-activity";

export const metadata: Metadata = {
  title: "AI Usage Monitor",
  description: "複数のChatGPTアカウントのCodex利用枠を可視化します。",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" className="dark">
      <body>
        <SessionActivity />
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
