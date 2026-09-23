import { NextResponse } from "next/server";
import { getPlaceImage } from "@/lib/place-image";

// A place's photo, by name: a redirect to Wikipedia's lead image for it (v6,
// the Stitch design draws a photo on every stop). Free and keyless — see
// lib/place-image.ts — and the answer is cached for a day at both ends, so a
// schedule scrolled twice asks Wikipedia once.
//
// A redirect rather than the URL in JSON, so the component is a plain <img>
// whose src is this route: no client fetch, no state, and the browser's own
// cache does the rest. 404 when there is no photo, which the <img> hears as
// onError and hides itself.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const near = params.get("near")?.trim() || null;
  if (!query || query.length > 200) {
    return new NextResponse(null, { status: 400 });
  }

  const url = await getPlaceImage(query, near);
  if (!url) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
