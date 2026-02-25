import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import NavigationSidebar from "@/components/NavigationSidebar";
import ViewManager from "@/components/ViewManager";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Physical TSA Schools Map",
  description:
    "A map to keep track of locations where we can put physical Texas Sports Academy locations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${poppins.variable} font-sans antialiased`}
      >
        <ReactQueryProvider>
          <NavigationSidebar />
          <div className="ml-20">
            <ViewManager />
            {children}
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
