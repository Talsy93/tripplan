import * as z from "zod";
import { suggestedDestinationSchema } from "./suggested-destination";

// One saved destination of a trip, as the home's world map draws it once a
// trip is "opened" there (a second tap on it): a named point with a category
// for its colour. A projection of suggested_destinations — derived from the
// entity's schema, never a second definition of it — narrowed to the rows that
// have coordinates, since a place with none has nowhere to be drawn.
export const tripMapPlaceSchema = suggestedDestinationSchema
  .pick({ name: true, city: true, category: true })
  .extend({ latitude: z.number(), longitude: z.number() });
export type TripMapPlace = z.infer<typeof tripMapPlaceSchema>;
