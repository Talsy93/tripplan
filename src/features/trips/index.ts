export {
  tripSchema,
  tripStatusSchema,
  createTripSchema,
  tripStatusLabels,
} from "./domain/trip";
export type {
  Trip,
  TripStatus,
  CreateTripInput,
  TripFormState,
} from "./domain/trip";
export {
  destinationSourceSchema,
  suggestedDestinationSchema,
} from "./domain/suggested-destination";
export type {
  DestinationSource,
  SuggestedDestination,
} from "./domain/suggested-destination";
export { itineraryItemSchema } from "./domain/itinerary-item";
export type { ItineraryItem } from "./domain/itinerary-item";
export {
  aiSuggestRequestSchema,
  aiDestinationSuggestionSchema,
  aiSuggestionsSchema,
} from "./domain/ai-suggestion";
export type {
  AiSuggestRequest,
  AiDestinationSuggestion,
  AiSuggestions,
} from "./domain/ai-suggestion";
export { createTrip } from "./application/actions";
export { listTrips } from "./infrastructure/trips-service";
export { CreateTripForm } from "./components/create-trip-form";
export { TripList } from "./components/trip-list";
