"use client";

import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// B0 — visual direction mockup. No data layer, no network, no DB.
// One set of markup; the two variants differ only through CSS variables set on
// the root, so whatever is chosen converts directly into tokens in B1.
// ---------------------------------------------------------------------------

type Variant = "playful" | "calm";
type Tone = "rose" | "amber" | "lilac" | "mint" | "sky" | "peach";

const CITIES: { name: string; nights: number; tone: Tone }[] = [
  { name: "ליסבון", nights: 3, tone: "rose" },
  { name: "סינטרה", nights: 1, tone: "amber" },
  { name: "פורטו", nights: 3, tone: "lilac" },
  { name: "אלגרבה", nights: 2, tone: "mint" },
];

const CATEGORIES: {
  emoji: string;
  label: string;
  count: number;
  tone: Tone;
}[] = [
  { emoji: "🍽️", label: "מסעדות", count: 47, tone: "rose" },
  { emoji: "☕", label: "בתי קפה", count: 23, tone: "amber" },
  { emoji: "🏛️", label: "מקומות ומוזיאונים", count: 31, tone: "lilac" },
  { emoji: "🌅", label: "תצפיות וטבע", count: 19, tone: "sky" },
  { emoji: "🛍️", label: "שופינג", count: 14, tone: "mint" },
  { emoji: "🥐", label: "מאפיות ומתוקים", count: 11, tone: "peach" },
];

const DAY_ITEMS: {
  time: string;
  title: string;
  sub?: string;
  emoji: string;
  tone: Tone;
}[] = [
  {
    time: "09:00",
    title: "ארוחת בוקר",
    sub: "Fábrica da Nata",
    emoji: "☕",
    tone: "amber",
  },
  { time: "10:30", title: "מנזר ז׳רונימוש", emoji: "🏛️", tone: "lilac" },
  {
    time: "13:00",
    title: "ארוחת צהריים",
    sub: "Time Out Market",
    emoji: "🍽️",
    tone: "rose",
  },
  { time: "15:00", title: "מגדל בלם", emoji: "🏛️", tone: "lilac" },
  {
    time: "17:30",
    title: "שקיעה במירדורו",
    sub: "Senhora do Monte",
    emoji: "🌅",
    tone: "sky",
  },
  {
    time: "20:00",
    title: "ארוחת ערב",
    sub: "Cervejaria Ramiro",
    emoji: "🍽️",
    tone: "rose",
  },
];

const TABS = [
  { label: "היום", emoji: "☀️" },
  { label: "ימים", emoji: "🗓️" },
  { label: "מה עושים?", emoji: "🧭" },
  { label: "מפה", emoji: "🗺️" },
  { label: "עוד", emoji: "☰" },
];

const CSS = `
.dp { --tint:#e8e0d4; --ink:#5b4a3f; --dot:#b9a692; }
.dp .t-rose  { --tint:#fbdce4; --ink:#a34c66; --dot:#e88ba4; }
.dp .t-amber { --tint:#fbe4c0; --ink:#8f5a18; --dot:#e8a94e; }
.dp .t-lilac { --tint:#e3daf7; --ink:#5f4499; --dot:#a98fe0; }
.dp .t-mint  { --tint:#cfe9d4; --ink:#356c47; --dot:#7cc08f; }
.dp .t-sky   { --tint:#d2e6f7; --ink:#33608a; --dot:#79b0dd; }
.dp .t-peach { --tint:#fbdcc8; --ink:#a45c33; --dot:#ef9f74; }

.dp[data-variant="playful"] {
  --dp-display: var(--font-display), var(--font-heebo), sans-serif;
  --dp-display-weight: 400;
  --dp-hero-num: 4.5rem;
  --dp-title: 1.75rem;
  --dp-emoji: 2.5rem;
  --dp-radius: 1.5rem;
  --dp-radius-sm: 1rem;
  --dp-fill: 1;
  --dp-stripe: 5px;
  --dp-shadow: 0 10px 30px rgba(59,47,42,.10);
}
.dp[data-variant="calm"] {
  --dp-display: var(--font-heebo), sans-serif;
  --dp-display-weight: 700;
  --dp-hero-num: 3.5rem;
  --dp-title: 1.375rem;
  --dp-emoji: 1.5rem;
  --dp-radius: 1rem;
  --dp-radius-sm: .75rem;
  --dp-fill: .3;
  --dp-stripe: 3px;
  --dp-shadow: 0 4px 14px rgba(59,47,42,.06);
}

.dp .display { font-family: var(--dp-display); font-weight: var(--dp-display-weight); line-height:1.15; letter-spacing:-.01em; }
.dp .tile { background: color-mix(in srgb, var(--tint) calc(var(--dp-fill) * 100%), #fffdfc); }
.dp .card { background:#fffdfc; border-radius: var(--dp-radius); box-shadow: var(--dp-shadow); }
.dp .emoji { font-size: var(--dp-emoji); line-height:1; }
.dp .stripe { border-inline-start: var(--dp-stripe) solid var(--dot); }
.dp .frame::-webkit-scrollbar { width:0; }
`;

function Chevron({ dir }: { dir: "prev" | "next" }) {
  // RTL: "previous" points right, "next" points left.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d={dir === "prev" ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function TopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
      <span className="text-base">🇵🇹</span>
      <span className="display text-sm">פורטוגל 2026</span>
      {children}
    </div>
  );
}

function BottomNav({ active }: { active: number }) {
  return (
    <div className="sticky bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-surface/95 px-1 pb-1 pt-2 backdrop-blur">
      {TABS.map((tab, i) => (
        <div
          key={tab.label}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] ${
            i === active ? "font-bold text-primary" : "text-muted"
          }`}
        >
          <span className="text-base leading-none">{tab.emoji}</span>
          <span className="truncate">{tab.label}</span>
        </div>
      ))}
    </div>
  );
}

function RouteChips() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
      {CITIES.map((city, i) => (
        <div key={city.name} className={`t-${city.tone} flex items-center gap-1.5`}>
          {i > 0 && <span className="text-xs text-white/60">←</span>}
          <span className="flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold" style={{ color: "var(--ink)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--dot)" }} />
            {city.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function CountdownHero({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative overflow-hidden text-center text-white"
      style={{
        borderRadius: "var(--dp-radius)",
        background:
          "linear-gradient(155deg,#c9785c 0%,#9a7658 45%,#6f5a68 100%)",
        boxShadow: "var(--dp-shadow)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10"
      />
      <div className={`relative flex flex-col items-center gap-3 px-5 ${compact ? "py-6" : "py-8"}`}>
        <p className="display text-white/90" style={{ fontSize: "var(--dp-title)" }}>
          פורטוגל מחכה לנו
        </p>
        <div className="text-6xl">🧳</div>
        <p className="text-xs text-white/75">עד ההמראה · 14.9</p>
        <p className="display leading-none" style={{ fontSize: "var(--dp-hero-num)" }}>
          33
        </p>
        <p className="-mt-1 text-sm font-semibold text-white/90">ימים</p>
        <RouteChips />
      </div>
    </div>
  );
}

function UpNext() {
  const items = [
    { emoji: "✈️", title: "טיסה TLV → LIS", meta: "14.9 · 06:20", badge: "עוד 33 ימים", tone: "sky" as Tone },
    { emoji: "🏨", title: "Baixa House", meta: "צ׳ק-אין 14.9", badge: "ליסבון", tone: "rose" as Tone },
    { emoji: "🎟️", title: "ארמון פנה — כניסה", meta: "17.9 · 11:00", badge: "עוד 36 ימים", tone: "amber" as Tone },
  ];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="display" style={{ fontSize: "calc(var(--dp-title) * .72)" }}>
        מה קרוב
      </h3>
      {items.map((item) => (
        <div key={item.title} className={`t-${item.tone} card stripe flex items-center gap-3 p-3`}>
          <span className="emoji">{item.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{item.title}</p>
            <p className="text-xs text-muted">{item.meta}</p>
          </div>
          <span
            className="tile shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {item.badge}
          </span>
        </div>
      ))}
    </div>
  );
}

function DayHeader() {
  return (
    <div className="t-rose tile flex items-center justify-between gap-2 px-4 py-5" style={{ borderRadius: "var(--dp-radius)" }}>
      <button className="rounded-full bg-white/70 p-1.5" style={{ color: "var(--ink)" }} aria-label="היום הקודם">
        <Chevron dir="prev" />
      </button>
      <div className="text-center" style={{ color: "var(--ink)" }}>
        <p className="display" style={{ fontSize: "var(--dp-title)" }}>ליסבון</p>
        <p className="text-xs font-semibold opacity-80">יום 2 מתוך 9 · ג׳, 15.9</p>
      </div>
      <button className="rounded-full bg-white/70 p-1.5" style={{ color: "var(--ink)" }} aria-label="היום הבא">
        <Chevron dir="next" />
      </button>
    </div>
  );
}

function DayStrip() {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((d) => (
        <div
          key={d}
          className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs ${
            d === 2
              ? "bg-primary font-bold text-primary-foreground"
              : "border border-border bg-surface text-muted"
          }`}
        >
          <span className="text-[10px] opacity-70">יום</span>
          <span className="font-bold">{d}</span>
        </div>
      ))}
    </div>
  );
}

function DayTimeline() {
  return (
    <div className="flex flex-col">
      {DAY_ITEMS.map((item, i) => (
        <div key={item.title + item.time} className={`t-${item.tone} flex gap-3`}>
          <div className="flex w-12 shrink-0 flex-col items-center pt-1">
            <span className="text-xs font-bold tabular-nums text-muted" dir="ltr">
              {item.time}
            </span>
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ background: "var(--dot)" }} />
            {i < DAY_ITEMS.length - 1 && (
              <span className="mt-1 w-px flex-1 border-e border-dashed border-border" />
            )}
          </div>
          <div className="card stripe mb-3 flex flex-1 items-center gap-3 p-3">
            <span className="emoji">{item.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.title}</p>
              {item.sub && <p className="truncate text-xs text-muted">{item.sub}</p>}
            </div>
            <span className="shrink-0 text-muted">
              <Chevron dir="next" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryGrid({ cols = 2 }: { cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {CATEGORIES.map((cat) => (
        <div
          key={cat.label}
          className={`t-${cat.tone} tile flex flex-col gap-2 p-4`}
          style={{ borderRadius: "var(--dp-radius)" }}
        >
          <span className="emoji">{cat.emoji}</span>
          <div style={{ color: "var(--ink)" }}>
            <p className="text-sm font-bold leading-tight">{cat.label}</p>
            <p className="text-xs opacity-75">{cat.count} מקומות</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchBar() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-muted">
      <SearchIcon />
      <span className="text-sm">חיפוש מקום…</span>
    </div>
  );
}

function Phone({ title, active, children }: { title: string; active: number; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <p className="text-center text-xs font-semibold text-muted">{title}</p>
      <div className="w-[375px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/10 bg-background">
        <div className="frame flex h-[700px] flex-col overflow-y-auto">
          <TopBar />
          <div className="flex flex-1 flex-col gap-5 p-4">{children}</div>
          <BottomNav active={active} />
        </div>
      </div>
    </div>
  );
}

function WideBlock({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-background p-5">
        {children}
      </div>
    </div>
  );
}

export function DesignPreview({ fontClassName }: { fontClassName: string }) {
  const [variant, setVariant] = useState<Variant>("playful");

  return (
    <main className={`${fontClassName} mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8`}>
      <style>{CSS}</style>

      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">B0 · בחירת כיוון עיצובי</h1>
          <p className="mt-1 text-sm text-muted">
            אותו מבנה בדיוק, שני אופיים. בחר אחד — הוא הופך לטוקנים ב-B1.
          </p>
        </div>

        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface-2 p-1">
          {(
            [
              ["playful", "שובב ומזמין"],
              ["calm", "האמצע — מאופק"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVariant(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                variant === id
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="max-w-2xl rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs text-muted">
          <strong className="text-foreground">ההבדל בין הווריאנטים:</strong> פונט
          התצוגה (Secular One מול Heebo מודגש), גודל האימוג׳י והכותרות, עוצמת
          צבעי הפסטל, ורדיוס הפינות. הצבע לכל עיר/קטגוריה קיים בשניהם — הוא
          העיקרון, לא הקישוט.
        </p>
      </header>

      <div className="dp flex flex-col gap-10" data-variant={variant}>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">מובייל · 375px (הבסיס)</h2>
          <div className="flex gap-6 overflow-x-auto pb-3">
            <Phone title="היום · לפני הטיול" active={0}>
              <CountdownHero />
              <UpNext />
            </Phone>

            <Phone title="ימים · הלו״ז של היום" active={1}>
              <DayHeader />
              <DayStrip />
              <DayTimeline />
            </Phone>

            <Phone title="מה עושים?" active={2}>
              <div>
                <h2 className="display" style={{ fontSize: "var(--dp-title)" }}>
                  לאן עכשיו?
                </h2>
                <p className="text-xs text-muted">מתוכנן, אופציונלי, וכל מה ששמרנו</p>
              </div>
              <SearchBar />
              <CategoryGrid cols={2} />
            </Phone>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-lg font-bold">
            מסך רחב · 1440px — השטח הפנוי הופך לעמודה שנייה
          </h2>

          <WideBlock
            title="היום"
            note="ההירו מקבל את הרוחב; ״מה קרוב״ עובר לעמודת צד במקום להידחף למטה"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <CountdownHero compact />
              <UpNext />
            </div>
          </WideBlock>

          <WideBlock
            title="ימים"
            note="רצועת הימים הופכת לעמודה קבועה בצד — בלי גלילה אופקית"
          >
            <div className="grid gap-6 lg:grid-cols-[110px_minmax(0,1fr)_minmax(0,320px)]">
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((d) => (
                  <div
                    key={d}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                      d === 2
                        ? "bg-primary font-bold text-primary-foreground"
                        : "border border-border bg-surface text-muted"
                    }`}
                  >
                    <span>יום {d}</span>
                    <span className="opacity-70">{13 + d}.9</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                <DayHeader />
                <DayTimeline />
              </div>
              <div className="flex flex-col gap-4">
                <div className="t-sky card stripe flex items-center gap-3 p-4">
                  <span className="emoji">☀️</span>
                  <div>
                    <p className="text-sm font-bold">24° / 17°</p>
                    <p className="text-xs text-muted">ליסבון · בהיר</p>
                  </div>
                </div>
                <UpNext />
              </div>
            </div>
          </WideBlock>

          <WideBlock
            title="מה עושים?"
            note="הפילטרים הופכים לעמודת צד קבועה, והרשת מתרחבת ל-4 עמודות"
          >
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <SearchBar />
                <p className="text-xs font-bold text-muted">לפי עיר</p>
                <div className="flex flex-col gap-1.5">
                  {CITIES.map((city) => (
                    <div
                      key={city.name}
                      className={`t-${city.tone} tile flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold`}
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--dot)" }} />
                      {city.name}
                      <span className="ms-auto opacity-70">{city.nights} לילות</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="display" style={{ fontSize: "var(--dp-title)" }}>
                    לאן עכשיו?
                  </h3>
                  <p className="text-xs text-muted">145 מקומות ב-4 יעדים</p>
                </div>
                <CategoryGrid cols={4} />
              </div>
            </div>
          </WideBlock>
        </section>
      </div>
    </main>
  );
}
