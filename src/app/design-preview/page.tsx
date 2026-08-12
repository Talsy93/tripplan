import { DesignPreview } from "./preview";

// Temporary page for choosing the phase B visual direction (item B0).
// Removed once B1's tokens are settled and applied. The display font now comes
// from the root layout, so nothing is loaded here.
export const metadata = {
  title: "TripPlan — בחירת כיוון עיצובי",
};

export default function DesignPreviewPage() {
  return <DesignPreview />;
}
