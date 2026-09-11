import type { Metadata, Viewport } from "next";
import { Noto_Sans_Hebrew, Rubik } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

// Two families, each with one job (v5, "מפה חיה"). Noto Sans Hebrew is the
// reading face — body, rows, labels. Rubik is the display face — headings and
// the numbers that carry the screen (day count, countdown, pin numbers).
// globals.css maps them to --font-sans / --font-display.
const notoSansHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-sans-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["500", "600", "700"],
});

// Required for env(safe-area-inset-*) to resolve to anything but 0 on iOS.
// Without it the fixed bottom nav sits under the home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
  // Painted behind the status bar once the app is installed, so it has to be
  // the header's colour and not the canvas's. Kept in step with
  // manifest.json's theme_color — the two disagreed until phase D.
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "MyTrip — תכנון טיולים",
  description: "תכנון טיולים חכם: הצעות יעדים, בחירה, ולוח זמנים מסודר.",
  // The manifest is what makes the app installable — and on iOS, installing is
  // the only way push notifications work at all (see PushToggle).
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "MyTrip",
    statusBarStyle: "default",
  },
  // Every entry is generated from one source by scripts/generate-icons.mjs.
  //
  // The SVG that used to lead this list is gone. It was still drawing the
  // previous plane mark, and being first it was the one browsers picked — so the
  // tab showed one logo while the home screen showed another. The source is now
  // a raster image, so there is nothing honest to put in an SVG.
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // Must be PNG, and must be fully opaque. iOS ignores an SVG apple-touch-icon
    // entirely, and it composites a transparent one onto black — which is
    // exactly the black tile that was reported on the home screen.
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${notoSansHebrew.variable} ${rubik.variable} h-full antialiased`}
    >
      {/* dvh, not vh: mobile browser chrome makes 100vh taller than the
          visible area, which a fixed bottom bar makes obvious. */}
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
