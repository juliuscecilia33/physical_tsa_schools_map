import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physical TSA Schools Map",
  description: "A map showing physical TSA schools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
