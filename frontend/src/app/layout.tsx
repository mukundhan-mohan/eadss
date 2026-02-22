import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const display = Lexend({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EADSS | Emotion & Anomaly Intelligence",
  description: "Production monitoring dashboard for emotion and anomaly detection in support signals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
