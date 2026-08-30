import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

// One family for the whole app. Phase D dropped Secular One as the display
// face: hierarchy now comes from size and weight on a single family, which is
// what makes a type system read as one voice instead of two. --font-display in
// globals.css points here, so the remaining font-display call sites are inert
// rather than broken while they are cleaned up.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
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
      className={`${heebo.variable} h-full antialiased`}
    >
      {/* dvh, not vh: mobile browser chrome makes 100vh taller than the
          visible area, which a fixed bottom bar makes obvious. */}
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
