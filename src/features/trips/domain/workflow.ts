import type { TripTabSegment } from "./trip-tabs";

// How the app is meant to be used, as data.
//
// It lives in the domain rather than as JSX in a page for two reasons. The
// steps have a real order that other screens want to reason about — which one
// is the trip currently on, what is the next thing to do — and the wording of
// "what this step is for" is product copy that should be in one place, not
// duplicated into an empty state and a help page that then drift.
//
// Each step names the tab it happens on, so the guide links to the actual
// screen for *this* trip rather than describing where to find it.

export type WorkflowStep = {
  id: string;
  title: string;
  // What the step is for, in one sentence.
  body: string;
  // The tab this happens on, and the label for the link to it.
  tab: TripTabSegment;
  // A sub-route under the tab, for the steps that live one level down.
  subPath?: string;
  action: string;
  // Practical notes — the things that are not obvious from the screen itself.
  tips?: string[];
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "dates",
    title: "1. תאריכים",
    body: "קבעו מתי אתם יוצאים וחוזרים. כמעט כל דבר אחר באפליקציה נגזר מזה — מספר הימים בלו״ז, הספירה לאחור, ותחזית מזג האוויר.",
    tab: "more",
    subPath: "trip",
    action: "פרטי הטיול",
    tips: [
      "בלי תאריכים הלו״ז עדיין עובד, אבל הוא לא יידע כמה ימים יש ולא יציג ימים ריקים.",
      "תחזית מזג אוויר זמינה עד 16 ימים קדימה — זו מגבלה של השירות החינמי.",
    ],
  },
  {
    id: "destinations",
    title: "2. יעדים",
    body: "בקשו הצעות ליעדים לפי מה שמעניין אתכם, ובחרו את הערים שייכנסו לטיול. אפשר גם לבקש עוד הצעות בלי לאבד את מה שכבר יש.",
    tab: "explore",
    action: "מה עושים?",
    tips: [
      "שכונה היא לא יעד נפרד — אם תבקשו שיבויה, האפליקציה תזהה שהיא חלק מטוקיו ולא תיצור יעד כפול.",
    ],
  },
  {
    id: "pick",
    title: "3. מה עושים בכל יעד",
    body: "לכל עיר יש מדריך: אזורי לינה, מסעדות, אטרקציות וחוויות. מה שמוסיפים נשמר במאגר של הטיול וממתין לשיבוץ.",
    tab: "explore",
    action: "מדריכי הערים",
    tips: [
      "״רענון הצעות״ מחליף את ההצעות בלבד — מה שהוספתם לטיול נשאר.",
      "חיפוש האטרקציות מביא מקומות אמיתיים מ-OpenStreetMap, עם כתובת ושעות פתיחה.",
      "מחפשים שכונה מסוימת? יש שדה ״אזור״ — הקלידו למשל Omotesando והחיפוש יתמקד בתוכה.",
    ],
  },
  {
    id: "bookings",
    title: "4. טיסות ולינה",
    body: "הזינו את הטיסות, הרכבות והמלונות. אלה לא רק תיעוד: הלו״ז מסתמך עליהם כדי לדעת באיזו עיר אתם בכל יום ומתי בדיוק אתם מגיעים.",
    tab: "more",
    subPath: "trip",
    action: "פרטי הטיול",
    tips: [
      "תאריכי הלינה הם מה שקובע איזה יום שייך לאיזו עיר — שבוע במלון בטוקיו = שבוע של טוקיו בלו״ז.",
      "טיסה שיוצאת בערב ונוחתת למחרת מסומנת כיום נסיעה, ולא ישובצו בו פעילויות.",
      "שתי טיסות רצופות מאותו שדה תעופה מזוהות כקונקשן, עם זמן ההמתנה ביניהן.",
    ],
  },
  {
    id: "itinerary",
    title: "5. בניית הלו״ז",
    body: "לחצו ״בנה לו״ז״ והאפליקציה תסדר את מה שבחרתם לימים ולשעות, לפי הלינה, זמני הטיסה וקרבה גאוגרפית בין המקומות.",
    tab: "days",
    action: "ימים",
    tips: [
      "אפשר לקבוע ידנית כמה ימים בכל עיר, וזה גובר על מה שמחושב מהלינה.",
      "יום שנשאר ריק מוצג עם כפתור לקבלת רעיונות מה-AI לאותה עיר.",
      "״בנייה מחדש״ מסדר את הלו״ז מאפס — פירוט ההגעה שהקלדתם נשמר.",
    ],
  },
  {
    id: "map",
    title: "6. אימות על המפה",
    body: "בדקו שהמסלול נראה הגיוני: תחנות לפי הסדר, וסיכה לכל מקום שהוספתם.",
    tab: "map",
    action: "מפה",
    tips: [
      "סיכה במקום הלא נכון? יש כפתור ״רענון המיקומים״ שמחשב אותן מחדש.",
      "מקומות מחיפוש האטרקציות מדויקים תמיד — הם מגיעים עם הקואורדינטות של OpenStreetMap.",
    ],
  },
  {
    id: "gear",
    title: "7. אריזה",
    body: "רשימת הציוד היא הדבר היחיד באפליקציה שממלאים לגמרי ביד — מה צריך לארוז תלוי בכם, ואף מודל לא יודע אילו תרופות אתם לוקחים. יש רשימות התחלה לכל קטגוריה בלחיצה אחת.",
    tab: "more",
    subPath: "gear",
    action: "ציוד",
    tips: [
      "סימון פריט לא מזיז אותו למטה — הפריט הבא שרוצים לסמן נשאר במקום שהוא היה.",
      "בסוף הטיול יש ״איפוס הסימונים״, שמנקה את הווי מבלי למחוק את הרשימה עצמה.",
    ],
  },
  {
    id: "during",
    title: "8. בזמן הטיול",
    body: "מסך ״היום״ מציג את הלו״ז של היום הנוכחי, איפה ישנים הלילה, ומה מתקרב.",
    tab: "today",
    action: "היום",
    tips: [
      "הפעילו ״תזכורות למכשיר״ כדי לקבל התראה על מועד ביטול חינם או משהו שצריך להזמין.",
      "אפשר לשתף את הטיול בקישור לצפייה בלבד — בלי מספרי אישור, כתובות מדויקות ומחירים.",
    ],
  },
];
