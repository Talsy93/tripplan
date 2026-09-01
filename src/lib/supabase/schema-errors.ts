// A write that failed because the database is behind the code, as opposed to any
// other write failure. Worth telling apart: the fix is running a migration, and
// no amount of retrying will help.
//
// PostgREST reports it either as Postgres' undefined_column (42703) or, more
// often, as its own schema-cache miss — hence matching on the text as well.
//
// It lived in infrastructure/itinerary-service.ts, where it was written, and by
// the time three unrelated services needed it — the itinerary, the route and the
// bookings — every one of them was importing a module about itineraries to ask a
// question about Postgres. Moved here rather than left there: this project has
// already broken its build once on an import cycle between two feature files
// (phase E), and the cheapest way not to have that argument again is for a
// generic helper not to live inside a specific one.
export function isSchemaOutOfDate(message: string): boolean {
  return (
    message.includes("42703") ||
    message.includes("PGRST204") ||
    /column .* does not exist/i.test(message) ||
    /could not find the .* column/i.test(message) ||
    /schema cache/i.test(message)
  );
}
