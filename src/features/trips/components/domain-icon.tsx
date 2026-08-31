import {
  Backpack,
  Camera,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Coffee,
  Croissant,
  Droplets,
  FileText,
  Hotel,
  Landmark,
  Pill,
  Plane,
  Plug,
  Shirt,
  ShoppingBag,
  Snowflake,
  Sun,
  Thermometer,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { DomainIconName } from "../domain/icons";

// One picture per domain name, in one place.
//
// A Record rather than a switch, so adding a name to DomainIconName fails to
// compile here instead of rendering nothing at some call site — the same
// contract trip-nav.tsx uses for its tab icons, and for the same reason.
//
// Two substitutions worth knowing about, because they are losses and not
// choices. lucide has no torii, so temples get Landmark; and it has no single
// glyph for "an attraction", so that is Camera — the thing you do there rather
// than the thing it is. Both were ⛩️ and 🗼 before, which were more literal and
// less consistent, and consistency is what this set is for.
const ICONS: Record<DomainIconName, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  lodging: Hotel,

  documents: FileText,
  clothing: Shirt,
  toiletries: Droplets,
  electronics: Plug,
  health: Pill,
  other: Backpack,

  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bakery: Croissant,
  shopping: ShoppingBag,
  temple: Landmark,
  attraction: Camera,

  clear: Sun,
  "partly-cloudy": CloudSun,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  showers: CloudRainWind,
  "snow-showers": CloudSnow,
  thunder: CloudLightning,
  unknown: Thermometer,
};

// Decorative by definition: a glyph is never the only thing saying what a row
// is, so this is always aria-hidden and callers must not rely on it for
// meaning. Inherits `currentColor`, which is the whole point of the change —
// inside a .tone-* subtree it takes the city's ink without being told.
export function DomainIcon({
  name,
  className = "h-[1.15em] w-[1.15em] shrink-0",
}: {
  name: DomainIconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
