import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem Absensi Digital",
  description: "Platform absensi digital dengan geofencing dan verifikasi perangkat",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sistem Absensi",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
        {children}
      </body>
    </html>
  );
}
