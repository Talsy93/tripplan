"use client";

import { useState } from "react";
import { Asterisk, Plus } from "lucide-react";
import { Banner, Button, Dialog, Input, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  removeEmergencyContact,
  saveEmergencyContact,
} from "../application/emergency-actions";
import { telHref, type EmergencyContact } from "../domain/emergency";

// The export's last card: "חירום וביטוח", two numbers side by side. The export
// also stamps it "Offline Ready" and "נגיש גם במצב טיסה" — this app caches
// nothing (public/sw.js says why), so neither claim would be true. The tag
// keeps its place and says what is: every number dials on a tap.
export function EmergencyCard({
  tripId,
  contacts,
}: {
  tripId: string;
  contacts: EmergencyContact[];
}) {
  // `null` closed, "new" adding, a contact editing.
  const [editing, setEditing] = useState<EmergencyContact | "new" | null>(null);

  return (
    <section className="flex flex-col gap-2 rounded-[20px] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Asterisk
            className="h-[22px] w-[22px] shrink-0 text-danger"
            strokeWidth={3}
            aria-hidden="true"
          />
          <h4 className="text-base leading-[22px] font-semibold text-foreground">
            חירום וביטוח
          </h4>
        </div>
        <span className="shrink-0 rounded-full bg-success-tint px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-success-ink">
          חיוג בלחיצה
        </span>
      </div>

      <div className="mt-0.5 grid grid-cols-2 gap-2">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="relative flex min-w-0 flex-col rounded-[14px] bg-surface-2 p-3"
          >
            {/* The whole tile edits; the number inside it dials. Two targets in
                one tile, so the number is the larger and the one that is a
                link — the thing you reach for in an emergency is the call. */}
            <button
              type="button"
              onClick={() => setEditing(contact)}
              className="text-start text-[10px] leading-[14px] font-semibold tracking-[0.02em] text-muted-strong hover:underline"
            >
              {contact.label}
            </button>
            <a
              href={telHref(contact.phone)}
              dir="ltr"
              className="mt-0.5 text-base leading-[22px] font-bold text-foreground wrap-anywhere"
            >
              {contact.phone}
            </a>
            {contact.detail && (
              <span
                className={cn(
                  "mt-1 text-[11px] leading-[14px] font-semibold tracking-[0.02em] wrap-anywhere",
                  // A reference number — a policy, a claim — reads as data and
                  // takes the link colour, as the export's policy line does; an
                  // address stays grey.
                  /\d{4,}/.test(contact.detail)
                    ? "text-primary"
                    : "text-muted-strong",
                )}
              >
                {contact.detail}
              </span>
            )}
          </div>
        ))}
        {contacts.length < 2 && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-border-strong/60 p-2 text-xs leading-4 font-medium text-primary hover:bg-surface-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {contacts.length === 0 ? "ביטוח, שגרירות, רופא" : "מספר נוסף"}
          </button>
        )}
      </div>
      {contacts.length >= 2 && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-11 items-center gap-1 self-start text-xs leading-4 font-medium text-primary hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          מספר נוסף
        </button>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "מספר חירום חדש" : "עריכת מספר חירום"}
      >
        {editing !== null && (
          <ContactForm
            key={editing === "new" ? "new" : editing.id}
            tripId={tripId}
            contact={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </section>
  );
}

function ContactForm({
  tripId,
  contact,
  onDone,
}: {
  tripId: string;
  contact: EmergencyContact | null;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    const result = await saveEmergencyContact(tripId, contact?.id ?? null, {
      label: formData.get("label")?.toString() ?? "",
      phone: formData.get("phone")?.toString() ?? "",
      detail: formData.get("detail")?.toString() ?? "",
    });
    setPending(false);
    if (result.ok) {
      showToast(contact ? "המספר עודכן" : "המספר נוסף");
      onDone();
      return;
    }
    setErrors(result.errors ?? {});
    setMessage(result.message ?? null);
  }

  async function remove() {
    if (!contact) return;
    setPending(true);
    const ok = await removeEmergencyContact(tripId, contact.id);
    setPending(false);
    if (ok) {
      showToast("המספר הוסר");
      onDone();
    } else {
      setMessage("ההסרה נכשלה. נסו שוב.");
    }
  }

  return (
    <form action={submit} noValidate className="flex flex-col gap-3">
      <Field label="למי המספר" error={errors.label}>
        <Input
          name="label"
          maxLength={80}
          required
          placeholder="למשל הראל ביטוח חו״ל"
          defaultValue={contact?.label ?? ""}
        />
      </Field>
      <Field label="טלפון" error={errors.phone}>
        <Input
          name="phone"
          type="tel"
          dir="ltr"
          maxLength={40}
          required
          placeholder="+972-3-7547070"
          defaultValue={contact?.phone ?? ""}
        />
      </Field>
      <Field label="פרט נוסף (לא חובה)" error={errors.detail}>
        <Input
          name="detail"
          maxLength={120}
          placeholder="מספר פוליסה או כתובת"
          defaultValue={contact?.detail ?? ""}
        />
      </Field>
      {message && <Banner tone="danger">{message}</Banner>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {contact ? "שמירה" : "הוספה"}
        </Button>
        {contact && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void remove()}
            disabled={pending}
          >
            הסרה
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-danger-ink">
          {error}
        </span>
      )}
    </label>
  );
}
