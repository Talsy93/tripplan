import { cn } from "@/lib/cn";

// A country's flag as a picture, not an emoji. Windows has no flag emoji — 🇮🇹
// renders there as the two letters "IT" — so the home export's flags (on the
// photo card, the thumbnails and the map pins) come from flagcdn.com: free,
// keyless, by ISO code.
export function flagImageUrl(countryCode: string): string {
  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`;
}

export function isFlagCode(code: string | null): code is string {
  return !!code && /^[a-z]{2}$/i.test(code);
}

export function CountryFlag({
  code,
  className,
}: {
  code: string | null;
  className?: string;
}) {
  if (!isFlagCode(code)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagImageUrl(code)}
      alt=""
      aria-hidden="true"
      className={cn(
        "inline-block h-[0.75em] w-auto rounded-[2px] align-baseline shadow-[0_0_0_1px_rgb(0_0_0/0.08)]",
        className,
      )}
    />
  );
}
