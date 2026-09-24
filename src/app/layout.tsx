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
          <div className="mx-auto flex w-full max-w-2xl items-center gap-4 overflow-x-auto whitespace-nowrap px-4 py-3">
            <span className="shrink-0 text-sm font-semibold">PrepOS</span>
            <Link href="/" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Dashboard
            </Link>
            <Link href="/today" className="shrink-0 text-sm font-semibold text-black hover:underline dark:text-white">
              Today&apos;s DSA
            </Link>
            <Link href="/mastery" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Mastery
            </Link>
            <Link href="/problems" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Problems
            </Link>
            <Link href="/revise" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Revise Today
            </Link>
            <Link href="/exams" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Exams
            </Link>
            <Link href="/library" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Library
            </Link>
            <Link href="/college" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              College
            </Link>
            <Link href="/skills" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Skills
            </Link>
            <Link href="/projects" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Projects
            </Link>
            <Link href="/interview" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Interview
            </Link>
            <Link href="/resume" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Resume
            </Link>
            <Link href="/applications" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Applications
            </Link>
            <Link href="/insights" className="shrink-0 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
              Insights
            </Link>
          </div>
        </nav>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
