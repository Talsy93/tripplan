import { Skeleton } from "@/components/ui";

// Heights mirror TripAuraBand, so the band does not resize under the reader
// when it arrives. It used to mirror CountdownHero, which this tab no longer
// renders — the countdown moved into the band in the (tabs) layout.
//
// The band is min-h-[11rem] and full-bleed, so the skeleton is too: a padded
// 11rem block would jump sideways as well as vertically when the real one
// arrived.
export default function Loading() {
  return (
    <>
      <Skeleton className="-mx-4 -mt-5 h-44 rounded-b-[1.75rem] md:-mx-6 lg:-mx-8" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </>
  );
}
