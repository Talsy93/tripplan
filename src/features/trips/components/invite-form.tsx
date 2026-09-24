"use client";

import { useActionState, useState } from "react";
import {
  Check,
  Copy,
  MessageCircle,
  Mail,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Select,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  TRIP_ROLES,
  TRIP_ROLE_ORDER,
  inviteMessage,
  inviteUrl,
  normalizePhone,
  smsUrl,
  whatsappUrl,
  type InviteActionState,
  type TripRole,
} from "../domain/membership";
import { inviteToTrip } from "../application/membership-actions";

// The role picker's words, short enough for the narrow box Pencil puts beside
// the email field. The caption under the row spells out what each one allows,
// from TRIP_ROLES — the same short words the member list's pills use.
const ROLE_SHORT: Record<TripRole, string> = {
  viewer: "צפייה",
  editor: "עריכה",
};

// Inviting a person to a trip, and then getting the link to them.
//
// Two steps on purpose, and the second one is the interesting half. The app
// cannot send the invitation: Supabase's built-in mailer allows a couple of
// messages an hour on the free tier, and both SMTP and SMS providers are paid —
// which this project does not use. So the owner is handed the link and sends it
// from an app the recipient already trusts. That is free, and a WhatsApp message
// from a number somebody recognises gets opened, which is more than can be said
// for a transactional email from an unfamiliar domain.
//
// The email is the identity; the phone number is only a delivery channel. The
// invite can only be redeemed by an account whose email matches, whatever route
// the link travelled to get there.
export function InviteForm({
  tripId,
  tripName,
  origin,
}: {
  tripId: string;
  tripName: string;
  // Passed from the server rather than read from `window`. DeliverInvite below
  // only ever renders after a client-side action today, so reading window there
  // happens to work — but that is a property of this call site and not of the
  // component, and the identical pattern in ShareTrip crashed production.
  origin: string;
}) {
  const [state, action, pending] = useActionState<InviteActionState, FormData>(
    inviteToTrip,
    undefined,
  );

  // Kept in the parent, outside the keyed form below, so issuing an invite does
  // not reset the choice — inviting two people usually means inviting them the
  // same way.
  const [role, setRole] = useState<TripRole>("editor");

  const token = state?.token ?? null;

  return (
    <Card className="flex flex-col gap-4 rounded-[20px] p-4">
      {/* Pencil's invite card carries its own title, so the screen does not
          need a section heading over it. */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-foreground">הזמנת מטייל</h3>
        <p className="text-xs text-muted">
          חשבון מוזמן רואה את הטיול כמו שהבעלים רואה אותו — בלי צנזור, מהמכשיר
          שלו ועם החשבון שלו.
        </p>
      </div>
      {/* Keyed by the token so a successful invite remounts the form and clears
          the email field.
          This replaces a useEffect that called setState when the token changed —
          which is the "synchronise React state with React state" anti-pattern
          the react-hooks lint rule exists to catch. A key expresses the same
          intent ("this is a new form now") without a cascading render. */}
      <form key={token ?? "new"} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="tripId" value={tripId} />

        {/* Email and role side by side even on a phone, as Pencil draws
            them: the role is two short words and does not need a row. */}
        <div className="flex items-start gap-2">
          <Field
            label={<span className="sr-only">אימייל של מי שמצטרף</span>}
            error={state?.errors?.email?.join(" ")}
            className="min-w-0 flex-1"
          >
            <Input
              name="email"
              type="email"
              dir="ltr"
              placeholder="כתובת מייל"
              required
              aria-invalid={state?.errors?.email ? true : undefined}
              className="h-12 rounded-[14px] border-border bg-surface placeholder:text-right"
            />
          </Field>

          <Field
            label={<span className="sr-only">הרשאה</span>}
            className="w-28 shrink-0"
          >
            <Select
              name="role"
              value={role}
              onChange={(event) =>
                setRole(event.currentTarget.value as TripRole)
              }
              className="h-12 rounded-[14px] border-border bg-surface text-sm font-semibold"
            >
              {TRIP_ROLE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {ROLE_SHORT[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* The identity rule and what the chosen role allows, in one quiet
            caption rather than two hints under two fields. */}
        <p className="text-caption text-muted">
          רק חשבון עם האימייל הזה יוכל לפתוח את ההזמנה. {TRIP_ROLES[role].hint}
        </p>

        <Button
          type="submit"
          loading={pending}
          className="min-h-11 self-stretch rounded-full sm:self-start"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          יצירת הזמנה
        </Button>

        {state?.message && <Banner tone="danger">{state.message}</Banner>}
      </form>

      {/* Also keyed: a second invite must not inherit the phone number typed for
          the first person, and the state that would have to be cleared lives
          entirely inside this component. */}
      {token && (
        <DeliverInvite
          key={token}
          token={token}
          tripName={tripName}
          role={role}
          origin={origin}
        />
      )}
    </Card>
  );
}

// Getting the link to the person. Its own component so its state resets with the
// token, and so the parent holds nothing that needs clearing.
function DeliverInvite({
  token,
  tripName,
  role,
  origin,
}: {
  token: string;
  tripName: string;
  role: TripRole;
  origin: string;
}) {
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  // The origin comes from the request on the server, which keeps the link right
  // on localhost, on a preview deployment and in production with nothing to
  // configure — without depending on this component never being rendered on the
  // server. That dependency is what broke ShareTrip.
  const url = inviteUrl(origin, token);
  const message = inviteMessage(tripName, url, role);
  const wa = whatsappUrl(phone, message);
  const sms = smsUrl(phone, message);

  // Distinguishes "nothing typed yet" from "typed something that is not a
  // number", so the hint only appears when there is something to correct.
  const phoneTyped = phone.trim() !== "";
  const phoneValid = normalizePhone(phone) !== null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("הקישור הועתק");
    } catch {
      showToast("לא הצלחנו להעתיק. סמנו את הקישור והעתיקו ידנית.", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-sm font-semibold">ההזמנה נוצרה. עכשיו שלחו את הקישור:</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[14px]"
          aria-label="קישור ההזמנה"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy()}
          className="min-h-11 shrink-0 rounded-full"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? "הועתק" : "העתקה"}
        </Button>
      </div>

      {/* The phone number, which is a channel and not a login. Spelled out in
          the hint because "invite by phone" reasonably sounds like the phone
          number *is* the account, and it is not. */}
      <Field
        label="שליחה לטלפון (לא חובה)"
        hint="נפתח בוואטסאפ או ב-SMS שלכם עם ההודעה מוכנה. ההזדהות עצמה נשארת לפי האימייל."
        className="min-w-0"
      >
        <Input
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
          dir="ltr"
          type="tel"
          inputMode="tel"
          placeholder="050-1234567"
          aria-invalid={phoneTyped && !phoneValid ? true : undefined}
        />
      </Field>

      {phoneTyped && !phoneValid && (
        <p className="text-caption text-danger-ink">
          המספר לא נראה תקין. אפשר גם 050-1234567 וגם ‎+972501234567.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* Anchors and not buttons: these hand the visitor off to another
            application, which is what a link does. */}
        <Channel href={wa} external label="וואטסאפ" Icon={MessageCircle} />
        <Channel href={sms} label="SMS" Icon={MessageSquare} />
        <Channel
          href={`mailto:?subject=${encodeURIComponent(
            `הזמנה לטיול ${tripName}`,
          )}&body=${encodeURIComponent(message)}`}
          label="מייל"
          Icon={Mail}
        />
      </div>

      <Banner tone="info">
        הקישור אישי וחד-פעמי. מי שיפתח אותו יתבקש להתחבר, ורק חשבון עם אותו
        אימייל יקבל גישה — אם הקישור יועבר למישהו אחר הוא לא יעבוד אצלו.
      </Banner>
    </div>
  );
}

// A delivery channel. Disabled rather than hidden when there is no valid phone
// number: the buttons appearing only after a number is typed would leave the row
// empty and the feature undiscoverable.
function Channel({
  href,
  label,
  Icon,
  external = false,
}: {
  href: string | null;
  label: string;
  Icon: typeof Mail;
  external?: boolean;
}) {
  const enabled = href !== null;

  return (
    <a
      href={href ?? undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-disabled={!enabled}
      // An <a> with no href is not focusable and not clickable, which is the
      // correct disabled state for a link — but a stray click on the padding
      // should still not navigate anywhere, hence the guard.
      onClick={(event) => {
        if (!enabled) event.preventDefault();
      }}
      className={cn(
        "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-2 text-sm font-semibold text-foreground",
        enabled
          ? "transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </a>
  );
}
