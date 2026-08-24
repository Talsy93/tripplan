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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    // Must be PNG. iOS ignores an SVG apple-touch-icon entirely and falls back
    // to a screenshot of the page for the home-screen tile — which is also the
    // icon shown next to a push notification.
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
