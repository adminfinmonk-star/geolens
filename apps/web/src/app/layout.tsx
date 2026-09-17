import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GeoLens - Auditable AI API Monitoring",
  description:
    "Track, analyze, and improve brand performance on AI search platforms",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

/** Light is default. Dark only when the user explicitly chose it. */
const THEME_INIT = `try{var t=localStorage.getItem("geo_theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");if(t==="system")localStorage.setItem("geo_theme","light")}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${sans.variable} ${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: THEME_INIT is a
            static local constant, not user input; it must run before paint to
            avoid a theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        style={
          {
            ["--font-display" as string]:
              "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
            ["--font-body" as string]:
              "var(--font-jakarta), var(--font-inter), Plus Jakarta Sans, Inter, sans-serif",
            ["--font-mono" as string]:
              "var(--font-plex), IBM Plex Mono, monospace",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
