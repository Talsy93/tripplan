import { Secular_One } from "next/font/google";
import { DesignPreview } from "./preview";

// Temporary page for choosing the phase B visual direction (item B0).
// Deleted once B1 locks the tokens in. The display font is loaded here only —
// it does not touch the real app's layout until it is chosen.
const secular = Secular_One({
  variable: "--font-display",
  subsets: ["hebrew", "latin"],
  weight: "400",
});

export const metadata = {
  title: "TripPlan — בחירת כיוון עיצובי",
};

export default function DesignPreviewPage() {
  return <DesignPreview fontClassName={secular.variable} />;
}
