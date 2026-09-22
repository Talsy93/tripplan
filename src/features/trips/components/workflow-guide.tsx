import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { Badge, Card, Disclosure } from "@/components/ui";
import { WORKFLOW_STEPS } from "../domain/workflow";

// The order of work, with a link straight to the screen each step happens on.
//
// A server component: it renders text and links and holds no state, so there
// is no reason to ship it to the browser.
//
// `tripId` is nullable because the guide is also shown on the home screen,
// before any trip exists — that is where someone first needs to know what the
// app expects of them. With no trip there is nothing for a step to link to, so
// the links are dropped rather than pointed somewhere invented; the wording is
// the same either way, which is the reason WORKFLOW_STEPS is data in the domain.
export function WorkflowGuide({ tripId }: { tripId: string | null }) {
  return (
    <ol className="flex flex-col gap-3">
      {WORKFLOW_STEPS.map((step, index) => {
        const href = !tripId
          ? null
          : step.subPath
            ? `/trips/${tripId}/${step.tab}/${step.subPath}`
            : `/trips/${tripId}/${step.tab}`;

        return (
          <li key={step.id}>
            {/* The eight steps used to be eight open cards — prose and tips for
                all of them, which on a phone is the whole guide read in one
                scroll whether you wanted step 2 or step 7. Now the titles are
                the page and a step opens when asked; the first one is open so
                what a step contains is visible without pressing anything.

                `action` stays in the heading as text rather than as the link it
                used to be: it names where the step happens ("פרטי הטיול",
                "מה עושים?"), which is what you scan the list for, and a link
                inside a <summary> would be a press target fighting the one
                that opens the section. The link itself is the last thing in the
                body, where you reach it having read what to do there. */}
            <Disclosure
              title={step.title}
              meta={
                <span className="text-caption text-muted">{step.action}</span>
              }
              defaultOpen={index === 0}
            >
              <p className="max-w-measure text-sm text-muted">{step.body}</p>

              {step.tips && step.tips.length > 0 && (
                <ul className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3">
                  {step.tips.map((tip) => (
                    <li
                      key={tip}
                      className="flex items-start gap-1.5 text-caption text-muted"
                    >
                      <Lightbulb
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}

              {/* The link is the point of the guide — a step you have to go and
                  find is a step you read and forget. Absent only on the home
                  screen, where there is no trip yet to link into. */}
              {href && (
                <Link
                  href={href}
                  className="flex w-fit items-center gap-1 rounded-control text-sm font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {step.action}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </Disclosure>
          </li>
        );
      })}

      <li>
        <Card className="flex flex-col gap-2">
          <Badge tone="neutral" className="self-start">
            כלל אחד ששווה לזכור
          </Badge>
          <p className="text-sm">
            שום דבר שהוספתם לטיול לא נמחק מעצמו. רענון הצעות, בנייה מחדש של
            הלו״ז ושינוי תאריכים — כולם מחליפים הצעות או סידור, לא את הבחירות
            שלכם. הדרך היחידה להוציא משהו מהטיול היא להסיר אותו במפורש.
          </p>
        </Card>
      </li>
    </ol>
  );
}
