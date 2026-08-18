"use client";

// The last resort: an error thrown by the root layout itself, which means the
// normal error.tsx has no layout left to render inside. It has to supply its own
// <html> and <body>, and it cannot rely on the fonts or the token layer, so the
// few colours here are literal on purpose — the alternative is an unstyled page.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          background: "#eceef2",
          color: "#1a1d21",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          האפליקציה לא הצליחה לעלות
        </h1>
        <p style={{ color: "#5f6673", maxWidth: "28rem" }}>
          נסו לטעון מחדש. אם זה חוזר, כדאי לסגור את הכרטיסייה ולפתוח שוב.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: "2.5rem",
            padding: "0 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#0071c2",
            color: "#ffffff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ניסיון נוסף
        </button>
      </body>
    </html>
  );
}
