export {
  tripSchema,
  tripStatusSchema,
  createTripSchema,
  setTripDatesSchema,
  daysUntil,
  formatCountdown,
  formatShortDate,
  pickUpcomingTrip,
} from "./domain/trip";
export type {
  Trip,
  TripStatus,
  CreateTripInput,
  TripFormState,
  SetTripDatesInput,
  TripDatesFormState,
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
  routeBounds,
  routeSummary,
  cityByDay,
  itineraryStops,
} from "./domain/route";
export {
  categoryLabel,
  placeCategorySchema,
  placeSchema,
  placeSearchRequestSchema,
  selectableCategorySchema,
  manualPlaceSchema,
  manualPlaceDescription,
  PLACE_CATEGORIES,
  MIN_DETAILS,
  distanceKm,
  countDetails,
  isWorthShowing,
  comparePlaces,
  savedCountsByCategory,
} from "./domain/place";
export type {
  Place,
  PlaceCategory,
  PlaceSearchRequest,
  SelectableCategory,
  ManualPlaceInput,
} from "./domain/place";
export type { RouteStop, TripRoute } from "./domain/route";
export {
  aiSuggestRequestSchema,
  aiCitySuggestionSchema,
  aiCitySuggestionsSchema,
  aiCityGuideRequestSchema,
  aiRecommendationSchema,
  aiCityGuideSchema,
  aiCategoryKeySchema,
  aiMoreRecommendationsRequestSchema,
  aiRecommendationsSchema,
  aiItineraryRequestSchema,
  aiItinerarySchema,
  mergeCitySuggestions,
  newCitySuggestions,
} from "./domain/ai-suggestion";
export type {
  AiSuggestRequest,
  AiCitySuggestion,
  AiCitySuggestions,
  AiCityGuideRequest,
  AiRecommendation,
  AiCityGuide,
  CityGuideData,
  GuideItem,
  SavedCityGuide,
  SelectedItem,
  AiCategoryKey,
  AiMoreRecommendationsRequest,
  AiRecommendations,
  AiItineraryRequest,
  AiItinerary,
  ItineraryDay,
  ItineraryEntry,
} from "./domain/ai-suggestion";
export { createTrip, deleteTrip } from "./application/actions";
export { setTripDates } from "./application/date-actions";
export {
  saveGuide,
  saveMore,
  refreshGuide,
  saveCities,
  addMoreCities,
  setSelected,
} from "./application/guide-actions";
export { deleteItineraryEntry } from "./application/itinerary-actions";
export {
  getTrip,
  listTrips,
  updateTripDates,
} from "./infrastructure/trips-service";
export {
  getSavedCityGuide,
  getSavedCities,
  getSelectedDestinations,
  getSelectedCitiesByTrip,
  getPrimaryDestination,
  appendCities,
} from "./infrastructure/guide-service";
export {
  getItinerary,
  getItineraryDayCount,
  saveItinerary,
  setTripStatus,
} from "./infrastructure/itinerary-service";
export { getTripRoute, getCityCenter } from "./infrastructure/route-service";
export {
  addPlaceToTrip,
  addManualPlace,
  getAddedPlaces,
} from "./infrastructure/place-service";
export type { AddedPlace } from "./infrastructure/place-service";
export { addPlace, createManualPlace } from "./application/place-actions";
export type { ManualPlaceResult } from "./application/place-actions";
export {
  bookingKindSchema,
  bookingSchema,
  createBookingSchema,
  BOOKING_KINDS,
  bookingAlert,
  bookingWhere,
  bookingNights,
} from "./domain/booking";
export type {
  Booking,
  BookingKind,
  BookingAlert,
  CreateBookingInput,
  BookingFormState,
} from "./domain/booking";
export { listBookings } from "./infrastructure/booking-service";
export { tripDayCount, buildDayCityPlan, travelDayCount } from "./domain/trip-days";
export type { DayCityPlan } from "./domain/trip-days";
export {
  dayCityPlanPromptLines,
  dayCityPlanHasFacts,
  reconcileItineraryWithDayPlan,
} from "./domain/itinerary-plan";
export { isSchemaOutOfDate } from "./infrastructure/itinerary-service";
export {
  cityDayPlan,
  cityDayTotals,
  cityDaysPromptLine,
  cityDaysSchema,
  setCityDaysSchema,
} from "./domain/city-days";
export type { CityDayPlan, CityDays } from "./domain/city-days";
export {
  listCityDays,
  setCityDays as writeCityDays,
} from "./infrastructure/city-days-service";
export { updateItineraryEntrySchema } from "./domain/itinerary-edit";
export type { UpdateEntryResult } from "./domain/itinerary-edit";
export {
  setCityDays,
  updateItineraryEntry,
} from "./application/itinerary-actions";
export {
  addBooking,
  editBooking,
  removeBooking,
} from "./application/booking-actions";
export { updateBookingSchema, toDateTimeLocal } from "./domain/booking";
export type { UpdateBookingInput } from "./domain/booking";
export {
  costTotalsByCurrency,
  costedCities,
  filterByCity,
  uncostedCount,
  formatMoney,
  currencySymbol,
  CURRENCIES,
  DEFAULT_CURRENCY,
  UNASSIGNED_CITY,
} from "./domain/expenses";
export type { CurrencyTotal, CurrencyCode } from "./domain/expenses";
export { ExpenseSummary } from "./components/expense-summary";
export {
  findConnections,
  connectedBookingIds,
  layoverLabel,
} from "./domain/booking";
export type { Connection } from "./domain/booking";
export { dominantCountry, stopsByCountry } from "./domain/route";
export {
  resetTripLocations,
  resolveAreaInCity,
} from "./infrastructure/route-service";
export { resetLocations } from "./application/route-actions";
export { ResetLocationsButton } from "./components/reset-locations-button";
export { UnlocatedCities } from "./components/unlocated-cities";
export { locateCity } from "./application/route-actions";
export { DaySuggestionsDialog } from "./components/day-suggestions-dialog";
export { WORKFLOW_STEPS } from "./domain/workflow";
export type { WorkflowStep } from "./domain/workflow";
export { WorkflowGuide } from "./components/workflow-guide";
export { withEmptyDays, cityOfEmptyDay } from "./domain/itinerary-plan";
export {
  redactBooking,
  isShareToken,
  generateShareToken,
} from "./domain/share";
export type { SharedTrip, SharedBooking } from "./domain/share";
export {
  getSharedTrip,
  getShareToken,
  shareTrip,
  unshareTrip,
} from "./infrastructure/share-service";
export { enableSharing, disableSharing } from "./application/share-actions";
export { ShareTrip } from "./components/share-trip";
export {
  cancellationAlert,
  bookingTodoAlert,
  doubleBookedLodgingIds,
  deadlineDate,
  reminderDays,
  DEFAULT_REMINDER_DAYS,
  REMINDER_PRESETS,
} from "./domain/booking";
export { dueReminders } from "./domain/reminders";
export type { DueReminder, ReminderKind } from "./domain/reminders";
export {
  registerPushSubscription,
  unregisterPushSubscription,
  isPushRegistered,
} from "./application/push-actions";
export { PushToggle } from "./components/push-toggle";
export { BookingForm } from "./components/booking-form";
export { BookingList } from "./components/booking-list";
export {
  forecastWindow,
  describeWeather,
  todayIn,
  APP_TIME_ZONE,
  addDays,
  daysBetween,
  weekdayLabel,
  MAX_FORECAST_DAYS,
} from "./domain/weather";
export {
  tripPhase,
  dateOfDay,
  dayNumberOfDate,
  currentDayNumber,
  clampDay,
  focusDayNumber,
  itineraryOverrun,
  bookingsByDay,
  lodgingByDay,
  nightStayLabel,
  dayLabel,
  dayOfTripLabel,
  phaseLabel,
} from "./domain/trip-days";
export type { TripPhase, NightLodging } from "./domain/trip-days";
export { NightStay } from "./components/night-stay";
export { lodgingOrigin, entryDestination } from "./domain/directions";
export { aiErrorMessage, aiErrorFromResponse } from "./domain/ai-errors";
export type { AiErrorCode } from "./domain/ai-errors";
export { DayPager } from "./components/day-pager";
export type {
  DailyWeather,
  CityWeather,
  ForecastWindow,
} from "./domain/weather";
export { WeatherPanel } from "./components/weather-panel";
export { WeatherForecast } from "./components/weather-forecast";
export {
  aiPhraseSchema,
  aiPhraseSectionSchema,
  aiPhrasebookSchema,
  phrasebookRequestSchema,
  PHRASE_TOPICS,
} from "./domain/phrasebook";
export type {
  AiPhrase,
  AiPhraseSection,
  AiPhrasebook,
  PhrasebookRequest,
} from "./domain/phrasebook";
export {
  getPhrasebook,
  savePhrasebook,
} from "./infrastructure/phrasebook-service";
export { Phrasebook } from "./components/phrasebook";
export {
  chatRoleSchema,
  chatMessageSchema,
  sendChatRequestSchema,
  recentHistory,
  MAX_HISTORY_TURNS,
} from "./domain/chat";
export type { ChatRole, TripChatMessage, SendChatRequest } from "./domain/chat";
export {
  listChatMessages,
  appendChatMessages,
  clearChat,
} from "./infrastructure/chat-service";
export {
  aiPlanItemSchema,
  aiPlanCitySchema,
  aiTripPlanSchema,
  planFromChatRequestSchema,
  planTotals,
} from "./domain/trip-plan";
export type { AiPlanItem, AiPlanCity, AiTripPlan } from "./domain/trip-plan";
export { savePlanFromChat } from "./infrastructure/trip-plan-service";
export { resetChat, applyPlan } from "./application/chat-actions";
export { TripChat } from "./components/trip-chat";
export { PlanPreview } from "./components/plan-preview";
export { CreateTripForm, NewTripButton } from "./components/create-trip-form";
export { CityDaysEditor } from "./components/city-days-editor";
export { EditEntryDialog } from "./components/edit-entry-dialog";
export { DeleteTripButton } from "./components/delete-trip-button";
export { TripDatesForm } from "./components/trip-dates-form";

export { NowCard } from "./components/now-card";
export { UpNext } from "./components/up-next";
export { MoreBackLink } from "./components/more-back-link";
export { TripNav, TripSideNav } from "./components/trip-nav";
export {
  TRIP_TABS,
  tripTabHref,
  defaultTripTab,
} from "./domain/trip-tabs";
export type { TripTabSegment } from "./domain/trip-tabs";
export {
  TONES,
  toneClass,
  toneByIndex,
  cityToneMap,
  cityToneClass,
} from "./domain/tone";
export type { Tone } from "./domain/tone";
export { tripAura, assignTripAuras, auraHues } from "./domain/aura";
export type { AuraTrip } from "./domain/aura";
export { AURA_PALETTES } from "./domain/aura-palette";
export type { AuraPalette } from "./domain/aura-palette";
export { DomainIcon } from "./components/domain-icon";
export type { DomainIconName } from "./domain/icons";
export { AuraHero } from "./components/aura-hero";
export { TripAuraBand } from "./components/trip-aura-band";
export { TripList } from "./components/trip-list";
export { PlanningPanel } from "./components/planning-panel";
export { CityGuide } from "./components/city-guide";
export { SelectedList } from "./components/selected-list";
export { Itinerary } from "./components/itinerary";
export { RouteMap } from "./components/route-map";

export { DayTimeline } from "./components/day-timeline";
export {
  parseTimeLabel,
  formatMinutes,
  buildDayTimeline,
  dayNow,
  daySequence,
  isEndingSoon,
  isNightGap,
  durationLabel,
  distanceLabel,
} from "./domain/timeline";
export type {
  DayTimeline as DayTimelineData,
  TimelineEntry,
  Transition,
} from "./domain/timeline";
export { PlaceSearch } from "./components/place-search";
export { PlaceDetails } from "./components/place-details";
export { ManualPlaceForm } from "./components/manual-place-form";
export { RouteMapPanel } from "./components/route-map-panel";
export {
  gearCategorySchema,
  gearItemSchema,
  gearFormSchema,
  GEAR_CATEGORIES,
  GEAR_CATEGORY_ORDER,
  GEAR_STARTERS,
  normalizeCategory,
  groupGear,
  gearProgress,
  starterSuggestions,
} from "./domain/gear";
export type {
  GearCategory,
  GearItem,
  GearGroup,
  GearProgress,
  GearFormValues,
  GearFormState,
} from "./domain/gear";
export { listGear } from "./infrastructure/gear-service";
export {
  addGearItem,
  addGearItems,
  toggleGearItem,
  removeGearItem,
  uncheckAllGear,
} from "./application/gear-actions";
export { GearList } from "./components/gear-list";
export { WorkflowSummary, HowItWorks } from "./components/workflow-summary";
export {
  tripRoleSchema,
  tripMemberSchema,
  tripInviteSchema,
  inviteFormSchema,
  TRIP_ROLES,
  TRIP_ROLE_ORDER,
  inviteUrl,
  inviteMessage,
  normalizePhone,
  whatsappUrl,
  smsUrl,
  splitMembers,
  memberLabel,
} from "./domain/membership";
export type {
  TripRole,
  TripMember,
  TripInvite,
  InvitePreview,
  InviteFormValues,
  InviteFormState,
  InviteActionState,
} from "./domain/membership";
export {
  listMembers,
  listOpenInvites,
  peekInvite,
  canEditTrip,
  isTripOwner,
} from "./infrastructure/membership-service";
export {
  inviteToTrip,
  cancelInvite,
  changeMemberRole,
  revokeMember,
  redeemInvite,
} from "./application/membership-actions";
export { InviteForm } from "./components/invite-form";
export { MemberList } from "./components/member-list";
export { ShareButton } from "./components/share-button";
export { AcceptInvite } from "./components/accept-invite";
