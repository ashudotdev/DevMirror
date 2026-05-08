import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "DevMirror — AI Mentor for Developers",
  description:
    "Brutally honest AI mentor that diagnoses how you learn and think as a developer. Paste your code, notes, or roadmap and get real feedback.",
  keywords: [
    "AI mentor",
    "developer tools",
    "code review",
    "learning habits",
    "developer growth",
    "Gemini AI",
  ],
  authors: [{ name: "DevMirror" }],
  openGraph: {
    title: "DevMirror — AI Mentor for Developers",
    description:
      "Brutally honest AI mentor that diagnoses how you learn and think as a developer.",
    type: "website",
    siteName: "DevMirror",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DevMirror — AI Mentor for Developers",
    description:
      "Brutally honest AI mentor that diagnoses how you learn and think as a developer.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
