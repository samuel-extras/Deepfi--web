import type { Metadata } from "next";
import { Inter, Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import Navbar from "../components/navbar";
import { ModalRoot } from "@/components/modals";
import { Toaster } from "@/components/ui/sonner";
import { withDefaultMetadata } from "@/lib/metadata";
import { TooltipProvider } from "@/components/ui/tooltip";
import Providers from "@/providers";
import { cn } from "@/lib/utils";
// import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Prefer explicit public URL; otherwise derive from Vercel env or localhost.
const vercelUrl = process.env.VERCEL_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

export const metadata: Metadata = withDefaultMetadata({
  metadataBase: new URL(siteUrl),
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        > */}
        <Providers>
          <TooltipProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-3rem)] ">
              {children}
              {/* <div className="absolute min-h-svh h-full inset-0 -z-10 items-center px-5 py-24 bg-radial-[125%_125%_at_50%_10%] from-transparent from-50% to-violet-800" /> */}
            </main>
            <div id="modal-root" />
            <ModalRoot />
            <Toaster />
          </TooltipProvider>
        </Providers>{" "}
        {/* </ThemeProvider> */}
        {/* <div className="absolute top-0 -z-2 h-screen w-screen bg-radial-[ellipse_80%_80%_at_50%_-20%] from-[#8602f2]/40 to-transparent" /> */}
      </body>
    </html>
  );
}
