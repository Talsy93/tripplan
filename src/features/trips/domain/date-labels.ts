// The long Hebrew date lines of the Stitch home (2026-09-24): "12 - 18 באוקטובר
// 2024" on one month, "20 נובמבר - 4 דצמבר 2024" across two, and "מאי 2023"
// for a trip already taken. Formatting only — ISO calendar dates in, text out.

const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function parts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: MONTHS[month - 1] ?? "", day };
}

export function dateRangeLabel(
  start: string | null,
  end: string | null,
): string {
  if (!start) return "בלי תאריכים";
  const a = parts(start);
  if (!end || end === start) return `${a.day} ב${a.month} ${a.year}`;
  const b = parts(end);
  if (a.year !== b.year) {
    return `${a.day} ${a.month} ${a.year} - ${b.day} ${b.month} ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${a.day} ${a.month} - ${b.day} ${b.month} ${b.year}`;
  }
  return `${a.day} - ${b.day} ב${a.month} ${a.year}`;
}

export function monthYearLabel(date: string | null): string {
  if (!date) return "בלי תאריכים";
  const { month, year } = parts(date);
  return `${month} ${year}`;
}

// "טיול עבר (מאי 23)" — the map card's short form.
export function shortMonthYearLabel(date: string | null): string {
  if (!date) return "";
  const { month, year } = parts(date);
  return `${month} ${String(year).slice(-2)}`;
}

// How long ago a moment was, in the words of "עודכן לפני יומיים".
export function agoLabel(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? "לפני שבוע" : weeks === 2 ? "לפני שבועיים" : `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "לפני חודש" : months === 2 ? "לפני חודשיים" : `לפני ${months} חודשים`;
  return "לפני יותר משנה";
}
