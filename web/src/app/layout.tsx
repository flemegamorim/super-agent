import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthLayoutShell } from "@/components/auth-layout-shell";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Super Agent Dashboard",
  description: "Agent task flow dashboard for file processing pipelines",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        <SessionProvider>
          <AuthLayoutShell>{children}</AuthLayoutShell>
        </SessionProvider>
      </body>
    </html>
  );
}
