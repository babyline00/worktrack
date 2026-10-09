import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NAS International — Workforce Management",
  description:
    "Workforce attendance & project monitoring by NAS International. One screen to know who is working, where they are, and how long they have been working.",
  keywords: [
    "NAS International",
    "Workforce Management",
    "Attendance",
    "Live Tracking",
    "Project Monitoring",
  ],
  authors: [{ name: "NAS International" }],
  // The favicon is src/app/icon.svg (the NAS mark). This used to point at a
  // third-party CDN hosting the scaffolding tool's "Z" logo, which meant every
  // browser tab and bookmark showed another company's mark.
  openGraph: {
    title: "NAS International — Workforce Management",
    description: "Real-time workforce attendance & project monitoring platform",
    siteName: "NAS International",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NAS International",
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
        <Providers>
          {children}
          <Toaster />
          <Sonner />
        </Providers>
      </body>
    </html>
  );
}
