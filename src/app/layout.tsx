import type { Metadata, Viewport } from "next";
import { Heebo, Secular_One } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

// Display face for headings and the countdown. Single weight by design — it is
// already heavy, and a second weight would only blur what it is for.
const secular = Secular_One({
  variable: "--font-secular",
  subsets: ["hebrew", "latin"],
  weight: "400",
});

// Required for env(safe-area-inset-*) to resolve to anything but 0 on iOS.
// Without it the fixed bottom nav sits under the home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
  // Painted behind the status bar once the app is installed.
  themeColor: "#faf7f2",
};

export const metadata: Metadata = {
  title: "TripPlan — תכנון טיולים",
  description: "תכנון טיולים חכם: הצעות יעדים, בחירה, ולוח זמנים מסודר.",
  // The manifest is what makes the app installable — and on iOS, installing is
  // the only way push notifications work at all (see PushToggle).
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TripPlan",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
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
      className={`${heebo.variable} ${secular.variable} h-full antialiased`}
    >
      {/* dvh, not vh: mobile browser chrome makes 100vh taller than the
          visible area, which a fixed bottom bar makes obvious. */}
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
