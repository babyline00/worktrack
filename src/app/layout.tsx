import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkTrack — Workforce Management",
  description:
    "Modern workforce attendance & project monitoring platform. One screen to know who is working, where they are, and how long they have been working.",
  keywords: [
    "WorkTrack",
    "Workforce Management",
    "Attendance",
    "Live Tracking",
    "Project Monitoring",
  ],
  authors: [{ name: "WorkTrack" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "WorkTrack — Workforce Management",
    description: "Real-time workforce attendance & project monitoring platform",
    siteName: "WorkTrack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkTrack",
    description: "Real-time workforce attendance & project monitoring platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
