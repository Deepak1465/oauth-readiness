import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Readiness",
  description: "How long it takes to get your own OAuth app approved, what blocks it, and what an agent can do for you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body>
        <header className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 16px" }}>
          <Link href="/" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 700, fontSize: 18 }}>
            OAuth Readiness
          </Link>
          <nav style={{ display: "flex", gap: 20, fontSize: 15 }}>
            <Link href="/#library">Library</Link>
            <Link href="/method">How guides are made</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="wrap faint" style={{ padding: "64px 16px 40px", fontSize: 14 }}>
          Guides are dated research, not legal advice. Provider rules change, so check the cited source before you rely on a claim.
        </footer>
      </body>
    </html>
  );
}
