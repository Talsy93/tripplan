// Name matching across the app.
//
// Several places have to decide whether two names refer to the same thing:
// linking an AI itinerary entry back to the item it came from, and linking a
// search result back to the itinerary day it was scheduled on. Both compare
// text that has passed through the AI, which echoes names back with different
// spacing or casing often enough to matter — so they have to normalise the
// same way, or one will match where the other doesn't.
export function normaliseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
