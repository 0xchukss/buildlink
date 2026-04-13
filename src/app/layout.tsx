import type { Metadata } from "next";
import { Chivo, Space_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BuilderLink Arc",
  description: "Decentralized job escrow and proof platform on Arc Testnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chivo.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="ethereum-define-guard" strategy="beforeInteractive">
          {`(function(){
  var originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj, prop, descriptor){
    if (obj === window && prop === 'ethereum') {
      try {
        return originalDefineProperty.apply(this, arguments);
      } catch (e) {
        console.warn('Prevented redefinition of window.ethereum');
        return obj;
      }
    }
    return originalDefineProperty.apply(this, arguments);
  };
})();`}
        </Script>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){
  try {
    var saved = localStorage.getItem('builderlink-theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved === 'light' || saved === 'dark' ? saved : (systemDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-[var(--app-bg)] text-[var(--ink)]">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
