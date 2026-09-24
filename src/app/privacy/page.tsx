import Link from "next/link";
import { Compass } from "lucide-react";
import { Banner } from "@/components/ui";
import { PageEnter } from "@/components/layout";

export const metadata = {
  title: "מדיניות פרטיות · MyTrip",
  description: "אילו נתונים MyTrip שומרת, למה, ואיך מוחקים אותם.",
};

// The privacy policy.
//
// Written from the code rather than from a template: every third party named
// below is one this app actually calls, enumerated from the source. Keeping it
// that way matters more than keeping it short — a policy that lists services the
// app does not use, or omits ones it does, is worse than none, because it is
// a specific claim that happens to be false.
//
// Deliberately NOT a generic "we may share your data with partners" document.
// There are no partners; there is a list, and it is the list below.
//
// ⚠️ This is an accurate description of what the software does. It is not legal
// advice, and it has not been reviewed by a lawyer. If the app ever serves users
// in the EU or UK in a commercial capacity, GDPR brings requirements this
// document does not attempt to satisfy on its own (a named controller, a lawful
// basis per purpose, a DPA with each processor, retention periods).
//
// Last reviewed: 2026-08-28. Any change to the third parties in
// `src/lib/ai`, `src/app/api` or `src/features/*/infrastructure` should be
// reflected here in the same commit.
const UPDATED = "28 באוגוסט 2026";

type Section = { title: string; body: string[]; list?: string[] };

const SECTIONS: Section[] = [
  {
    title: "מה נשמר עליכם",
    body: [
      "רק מה שנדרש כדי שהאפליקציה תעבוד. אין מעקב, אין פרסום, ואין פרופיל התנהגותי.",
    ],
    list: [
      "כתובת האימייל שלכם, וכן השם ותמונת הפרופיל אם נרשמתם דרך Google. סיסמאות נשמרות אצל ספק האימות בצורה מוצפנת חד-כיוונית ואינן נגישות לנו.",
      "התוכן שאתם יוצרים: טיולים, יעדים, לוח זמנים, הזמנות טיסה ולינה, הוצאות, שיחון, רשימת ציוד, והשיחות עם ה-AI בתוך הטיול.",
      "מי שיתפתם איתו טיול, ואילו הזמנות שליחתם ולמי — לפי כתובת האימייל שהזנתם.",
      "מנוי להתראות פוש, אם הפעלתם אותן. זהו מזהה של הדפדפן או המכשיר, לא שלכם.",
    ],
  },
  {
    title: "מה לא נשמר",
    body: [],
    list: [
      "אמצעי תשלום. אין באפליקציה תשלומים בכלל.",
      "מיקום המכשיר שלכם. חיפוש ״ליד כאן״ עובד לפי היעד שבחרתם, לא לפי GPS.",
      "עוגיות מעקב, פיקסלים, או כלי אנליטיקה של צד שלישי.",
      "מספרי הטלפון שאתם מקלידים בשיתוף. הם משמשים רק לבניית קישור שנפתח באפליקציה שלכם, ולא נשמרים בשום מקום.",
    ],
  },
  {
    title: "למי הנתונים מועברים",
    body: [
      "לספקי התשתית שהאפליקציה בנויה עליהם, ולא לאף אחד אחר. אין מכירה של נתונים ואין שיתוף למטרות שיווק.",
    ],
    list: [
      "Supabase — בסיס הנתונים והאימות. שם נשמר הכול.",
      "Vercel — האירוח. רואה נתוני בקשה תפעוליים, כולל כתובת IP.",
      "Google Gemini — הצעות היעדים, מדריכי הערים, בניית הלו״ז והשיחון. נשלח אליו תוכן הבקשה: שמות ערים, תאריכים, והעדפות שכתבתם. לא נשלחת כתובת האימייל שלכם.",
      "OpenStreetMap (Nominatim, Overpass ושרתי המפה) — חיפוש מקומות ואריחי המפה. הבקשות מגיעות משרת האפליקציה, למעט אריחי המפה שהדפדפן שלכם מוריד ישירות.",
      "Open-Meteo — תחזית מזג האוויר ביעדים.",
      "Google — רק אם בחרתם להתחבר דרכו.",
    ],
  },
  {
    title: "שיתוף טיול — מה נחשף",
    body: [
      "לאפליקציה שתי דרכי שיתוף, והן חושפות דברים שונים בכוונה.",
    ],
    list: [
      "קישור פומבי לצפייה: כל מי שמחזיק בכתובת רואה את הלו״ז, התחנות והטיסות — בלי מספרי אישור, בלי כתובות מדויקות ובלי מחירים. הקישור אינו מוגן בסיסמה, וכל מי שיקבל אותו ממי ששיתפתם יוכל להיכנס גם.",
      "הזמנה של אדם לפי אימייל: מי שמצטרף כך רואה את הטיול במלואו, כולל כתובות, מספרי אישור ומחירים — ובהרשאת עריכה גם יכול לשנות אותו. זו הסיבה שההזמנה אישית ולא עוברת למי שהקישור הועבר אליו.",
      "ביטול קישור פומבי או הסרת גישה מפסיקים לעבוד מיד. תוכן שכבר נצפה או הועתק אינו בשליטתנו.",
    ],
  },
  {
    title: "מחיקה",
    body: [
      "מחיקת טיול מוחקת אותו לצמיתות, יחד עם כל מה שתלוי בו: יעדים, לוח זמנים, הזמנות, הוצאות, ציוד ושיחות. הפעולה אינה הפיכה ואין ממנה שחזור.",
      "למחיקת החשבון כולו — פנו אלינו ונמחק אותו ואת כל הטיולים שבו. אין כרגע כפתור למחיקת חשבון באפליקציה.",
    ],
  },
  {
    title: "אבטחה",
    body: [
      "הגישה לנתונים נאכפת בשכבת בסיס הנתונים עצמו (Row Level Security), ולא רק בקוד האפליקציה — כלומר טיול שאינו שלכם אינו נגיש לכם גם בפנייה ישירה למסד.",
      "החלפת סיסמה מחייבת אישור דרך קישור שנשלח לאימייל. גם למי שנכנס לחשבון שלכם אין דרך לשנות את הסיסמה מתוך האפליקציה ולנעול אתכם בחוץ.",
    ],
  },
  {
    title: "יצירת קשר ושינויים",
    body: [
      "שאלה, בקשת מחיקה או תיקון — פנו דרך כתובת האימייל שממנה נרשמתם.",
      "אם המדיניות תשתנה, התאריך שלמעלה יתעדכן. שינוי מהותי יוצג לפני שהוא נכנס לתוקף.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* The Pencil signed-out frame: the wordmark on the canvas itself, no
          bar — the same header the shared-trip page opens with. */}
      <PageEnter className="mx-auto max-w-3xl flex-1 gap-5 px-4 pb-10 pt-6 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-start rounded-full text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[image:var(--hero-gradient)] text-white"
          >
            <Compass className="h-4 w-4" />
          </span>
          MyTrip
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-tight">מדיניות פרטיות</h1>
          <p className="text-sm text-muted">עודכן ב-{UPDATED}</p>
        </div>

        <Banner tone="info">
          התמצית: נשמר רק מה שדרוש כדי לתכנן את הטיול, אין מעקב ואין פרסום,
          והנתונים עוברים רק לספקי התשתית המפורטים למטה.
        </Banner>

        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-card"
          >
            <h2 className="text-lg font-bold">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="flex flex-col gap-2">
                {section.list.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm wrap-anywhere"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span className="min-w-0 text-muted-strong">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="text-caption text-muted">
          MyTrip הוא פרויקט אישי. המסמך הזה מתאר במדויק מה התוכנה עושה, והוא אינו
          ייעוץ משפטי.
        </p>

        <Link
          href="/signup"
          className="self-start rounded-full text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          חזרה להרשמה
        </Link>
      </PageEnter>
    </main>
  );
}
