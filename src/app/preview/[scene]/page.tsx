import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { developmentOnly } from "../guard";
import { SCENES_BY_SLUG } from "../scenes";

export const metadata = { title: "Preview scene · MyTrip (dev)" };

// One scene, rendered at the real viewport width.
//
// Full width and no app shell on purpose: the harness measures the component,
// and wrapping it in a sidebar and a header would measure those instead.
//
// A server component. The components it renders are mostly "use client"
// themselves, which is fine — a server component may render a client one. What
// it may not do is the reverse, which is what broke the first version of this.
export default async function ScenePage({
  params,
}: {
  params: Promise<{ scene: string }>;
}) {
  developmentOnly();

  const { scene: slug } = await params;
  const scene = SCENES_BY_SLUG.get(slug);

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-4">
      <Link
        href="/preview"
        className="flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        כל הסצנות
      </Link>

      {scene ? (
        <>
          <h1 className="text-sm font-bold">{scene.title}</h1>
          {/* `data-scene` is the hook the automated responsive pass uses:
              measure everything inside it against the viewport, and anything
              escaping is a real overflow rather than harness chrome. */}
          <div data-scene={scene.slug} className="min-w-0">
            {scene.render()}
          </div>
        </>
      ) : (
        <p className="text-sm text-danger-ink">אין סצנה בשם ״{slug}״.</p>
      )}
    </main>
  );
}
