import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "PrepOS",
  description: "What should I do now?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-5 px-4 py-3">
            <span className="text-sm font-semibold">PrepOS</span>
            <Link href="/" className="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Dashboard
            </Link>
            <Link href="/problems" className="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Problems
            </Link>
            <Link href="/revise" className="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Revise Today
            </Link>
          </div>
        </nav>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
