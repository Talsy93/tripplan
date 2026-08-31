import { cn } from "@/lib/cn";

// The light field: blurred blooms of colour over a deep base.
//
// Presentational and domain-free. It is handed CSS colours and has no idea what
// they mean — a feature decides what light a thing has (see
// features/trips/domain/aura.ts, which derives them from the city tones).
//
// Three variants, because there are three real jobs and no single set of values
// serves them. All were arrived at by measuring, and the notes below say what
// the measurement was:
//
//   solid — a hero with no photo. Opaque base, blooms spread wide, a gradient
//           floor on top to hold the text band down.
//   wash  — a hero over a photo. No base; the floor goes *under* the blooms so
//           the light lands on the darkened band and leaves the photo alone.
//   chip  — a small decorative tile (the 44px trip signatures). No text sits on
//           it, so it needs no floor at all, and the blooms move inside the box
//           because at 44px anything hung off the edge never appears.

type Variant = "solid" | "wash" | "chip";

type Bloom = { style: string; drift: string; opacity: number };

// Fixed positions rather than random, and in percentages so the same field
// composes at any size. The two drift tracks alternate, so blooms sharing a
// field never move as one block.
const LAYOUTS: Record<"hero" | "chip", readonly Bloom[]> = {
  hero: [
    { style: "top-[-32%] right-[-18%] w-[78%]", drift: "aura-drift-a", opacity: 0.9 },
    { style: "top-[14%] left-[-26%] w-[72%]", drift: "aura-drift-b", opacity: 0.78 },
    { style: "bottom-[-36%] right-[10%] w-[74%]", drift: "aura-drift-b", opacity: 0.85 },
  ],
  // Pulled inside and enlarged. Measured: with the hero layout, the 44px tiles
  // rendered as flat black — the blooms were hung far enough off the edge that
  // only their faint tails reached the box, and the floor then buried those.
  chip: [
    { style: "top-[-14%] right-[-10%] w-[95%]", drift: "aura-drift-a", opacity: 1 },
    { style: "bottom-[-18%] left-[-14%] w-[90%]", drift: "aura-drift-b", opacity: 0.95 },
    { style: "top-[22%] right-[26%] w-[80%]", drift: "aura-drift-b", opacity: 0.9 },
  ],
};

// Each bloom fades to #000, not to `transparent`, and blends with `screen`.
//
// Measured, not assumed: `transparent` is *transparent black*, so a gradient
// from a hue to `transparent` interpolates toward black and its midpoint goes
// muddy. Three hues doing that at once is exactly the brown-instead-of-glowing
// failure this effect is known for, and it is what the first version of this
// component did — the field read as a dark plum box rather than as light.
//
// `screen` is the fix, and it is the physically honest one: light adds. Under
// screen, black is the identity, so #000 costs nothing and there is no dark band
// anywhere — and two blooms overlapping brighten each other instead of covering
// each other. That is what lets three saturated hues share one small box.
function bloomStyle(blur: number, hue: string, opacity: number) {
  return {
    background: `radial-gradient(circle, ${hue} 0%, #000 70%)`,
    filter: `blur(${blur}px)`,
    mixBlendMode: "screen" as const,
    opacity,
  };
}

export function AuraField({
  hues,
  variant = "solid",
  // Off for anything small or repeated — a list of twenty tiles each running
  // two infinite compositor animations is the one way this gets expensive.
  animate = true,
  // Has to scale with the box, and this is why it is a prop and not a constant:
  // measured, a 42px blur on a 34px bloom diffused it out of existence and the
  // trip-list tiles came out solid black. CSS has no percentage blur, so only
  // the caller knows what is right for its own size. Roughly a quarter of the
  // box's shorter side.
  blur = 42,
  className,
}: {
  hues: string[];
  variant?: Variant;
  animate?: boolean;
  blur?: number;
  className?: string;
}) {
  const layout = LAYOUTS[variant === "chip" ? "chip" : "hero"];

  const blooms = hues.slice(0, layout.length).map((hue, i) => (
    <span
      key={i}
      className={cn(
        "absolute aspect-square rounded-full",
        layout[i].style,
        animate && layout[i].drift,
      )}
      style={bloomStyle(
        blur,
        hue,
        // Dimmer over a photo: there the blooms tint rather than paint, and at
        // full strength they bury whatever the photo was showing.
        variant === "wash" ? layout[i].opacity * 0.7 : layout[i].opacity,
      )}
    />
  ));

  // The readability floor exists only to protect text, which is why `chip` has
  // none: nothing is ever written on a 44px signature tile, so a floor there
  // only costs light.
  //
  // Where it does appear, stops matter as much as opacity. The first version ran
  // the gradient over the full height in `solid` too, which dimmed the blooms at
  // the top as well and was half of why the field read as a dark box.
  const floor =
    variant === "chip" ? null : (
      <span
        className={cn(
          "absolute inset-0",
          variant === "wash"
            ? // Never reaches zero, and that is not caution. Measured: a floor
              // that ran out at 72% left "עד ההמראה" on a sunlit building with
              // nothing behind it. These stops match what the old neutral scrim
              // covered — 0.74 / 0.42 / 0.18 across the full height, readable
              // over every photo the app had — so this changes the colour of
              // that cover, not how much of it there is.
              "bg-gradient-to-t from-aura-base/95 via-aura-base/70 via-40% to-aura-base/20"
            : "bg-gradient-to-t from-aura-base/85 via-aura-base/25 via-38% to-transparent to-64%",
        )}
      />
    );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        // `isolate` wherever there is an opaque base: it stops `screen` from
        // reaching past the field to the page behind it. `wash` must not
        // isolate — there the blend has to reach the photo below, which is the
        // whole point of that variant.
        variant !== "wash" && "isolate bg-aura-base",
        className,
      )}
    >
      {/* The order flips in `wash`, and that is the mechanism rather than a
          detail. Measured: with the floor on top, `wash` tinted nothing at all
          — a photo of a bright sky came out under a plain neutral gradient.
          That is `screen` behaving correctly: it lifts darks and leaves brights
          alone, so over a bright photo it has nothing to do.

          Putting the floor underneath uses the same physics instead of fighting
          it. The floor darkens the bottom band; the blooms then screen over
          that band, where colour shows plainly — and still do almost nothing to
          the bright photo above, which is what should happen to someone's photo
          of Tokyo. One rule, both outcomes. */}
      {variant === "wash" ? (
        <>
          {floor}
          {blooms}
        </>
      ) : (
        <>
          {blooms}
          {floor}
        </>
      )}
    </div>
  );
}
