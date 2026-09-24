---
name: Mediterranean Horizon
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#a73a00'
  on-secondary: '#ffffff'
  secondary-container: '#fd651e'
  on-secondary-container: '#571a00'
  tertiary: '#006948'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855d'
  on-tertiary-container: '#f5fff7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb599'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7f2b00'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Rubik
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Rubik
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Rubik
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Rubik
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Rubik
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
  body-lg:
    fontFamily: Rubik
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Rubik
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Rubik
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Rubik
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1rem
  margin-md: 1.25rem
  margin-lg: 1.5rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system delivers an intelligent, uplifting, and reassuring mobile travel companion crafted natively for Hebrew-speaking travelers (`dir="rtl"`). The aesthetic blends **Modern Tactile Minimalism** with **Warm Mediterranean Coastal** tones—conjuring sun-drenched coastlines, azure Mediterranean skies, and clear travel itineraries without overwhelming visual noise.

### Target Audience & Emotional Intent
- **Demographic:** Discerning modern travelers, frequent flyers, and family holiday planners seeking zero-friction navigation, precise logistics, and intuitive on-the-go tools.
- **Emotional Response:** Inspiring clarity, calm assurance during high-stress travel movements, and joyful discovery. The UI feels like an organized personal travel concierge resting natively in the palm of one's hand.

### Design Principles
- **RTL-First Spatial Fluidity:** Every directional visual cue, timeline progression, swipe gesture, and badge hierarchy is systematically mirrored for natural right-to-left reading flow.
- **Calm Grounding with Vibrant Energy:** Crisp sand-toned surfaces preserve ocular comfort under direct sunlight, paired with deep maritime blues and energetic coral callouts.
- **Curated Density:** Travel requires scanning critical data points (gate numbers, currency conversions, booking references) in glanceable, card-based modules with generous tap footprints.

## Colors

The palette draws directly from expansive sky and ocean vistas, balanced with sun-baked terracotta accents and grounding slate neutrals.

### Palette Architecture
- **Primary (`#0284C7` - Sky Blue / `#0369A1` - Deep Maritime):** Represents confidence, journeying, and core navigational structures. Used for primary app bars, active tab icons, brand anchors, and focal headers.
- **Secondary (`#EA580C` - Sunset Terracotta):** Infuses warmth and high urgency. Reserved exclusively for primary action triggers (e.g., "הוסף טיסה", "הזמן כעת"), urgent flight updates, and active timeline indicators.
- **Tertiary (`#059669` - Palm Emerald):** Designates verified states, confirmed bookings, on-time flight statuses, and completed packing tasks.
- **Neutrals (`#F8FAFC` to `#0F172A`):**
  - **Base Canvas:** `#F8FAFC` (Sand Mist) provides a softer background than stark white, minimizing eye fatigue during long transits.
  - **Surface Canvas:** `#FFFFFF` (Pure White) elevated for distinct containment cards.
  - **Muted Canvas:** `#F1F5F9` (Light Slate) for secondary groupings, chips, and unselected states.
  - **Text Primary:** `#0F172A` (Midnight Slate) delivering WCAG AAA contrast against white cards.
  - **Text Secondary:** `#64748B` (Steel Gray) for flight metadata, departure subtitles, and label hints.

## Typography

Typography is anchored entirely by **Rubik** (with natural system fallbacks to `Heebo`, `system-ui`, `-apple-system`). Rubik features softened corner geometry and open apertures, creating natural legibility for complex Hebrew diacritics and bilingual alphanumeric flight codes (e.g., `LY 001`, `Terminal 3`).

### Typography Rules & RTL Standards
- **Font Pairing:** All headline, body, and label tiers share **Rubik** to maintain visual harmony across Latin airport codes and Hebrew copy.
- **Bilingual Numerics:** Flight gates, departure times, and currency amounts maintain tabular figure alignment (`font-variant-numeric: tabular-nums`).
- **Line Heights:** Hebrew scripts require 5-10% more vertical breathing room than Latin typefaces to prevent diacritic clipping; all line-height definitions account for this extra clearance.
- **Weight Mapping:**
  - `700 (Bold)` for destination titles, airport codes, and critical alerts.
  - `600 / 500 (SemiBold / Medium)` for section headers, boarding times, interactive buttons, and navigation tabs.
  - `400 (Regular)` for AI advisory output, itinerary summaries, and packing list descriptors.

## Layout & Spacing

The layout is built upon an 8pt base grid with a fluid 4-column structure optimized for standard handheld viewports (360px–430px wide).

### Mobile Grid & Spatial Architecture
- **Screen Margins:** Set to `margin` (`1rem` / 16px) on compact phones, relaxing to `margin-lg` (`1.5rem` / 24px) on large phablets and mini-tablets.
- **Column Layout:** 4 fluid columns on mobile, expanding to 8 columns on tablet landscape.
- **Directional Geometry:**
  - Margins and padding strictly leverage CSS logical properties: `padding-inline-start`, `padding-inline-end`, `margin-inline-start`, `margin-inline-end`.
  - Primary anchor nodes (such as the timeline stem) reside on the right-hand boundary, allowing chronological progression to unfurl toward the left.
- **Rhythm Rules:**
  - Card internal padding: `space-md` (`1rem`) to `space-lg` (`1.5rem`).
  - Stack gaps between cards: `space-md` (`1rem`).
  - Micro gaps between icon-and-text indicators: `space-xs` (`0.25rem`) to `space-sm` (`0.5rem`).

## Elevation & Depth

Visual hierarchy uses a **Warm Mediterranean Ambient Layering** model. Deep harsh black drop-shadows are strictly avoided in favor of ocean-tinted, widely-diffused elevations that emulate crisp daylight.

### Elevation Levels
- **Level 0 (Flat Canvas):** `#F8FAFC`. Base canvas surface. No elevation.
- **Level 1 (Subtle Containers):** `#FFFFFF` with outline `1px solid rgba(226, 232, 240, 0.8)`. Used for passive checklist items and inactive tool tiles.
- **Level 2 (Active Cards & Boarding Passes):** `#FFFFFF` with `box-shadow: 0 4px 16px -2px rgba(2, 132, 199, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`. Delivers float and separation over the sand background.
- **Level 3 (Sticky Controls & Floating Action Tools):** `#FFFFFF` or `#0284C7` with `box-shadow: 0 10px 25px -4px rgba(2, 132, 199, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.06)`. Used for bottom navigation bars, quick-action sheets, and expanded itinerary drawer cards.
- **Level 4 (Modals & Urgent Disruption Alerts):** `box-shadow: 0 20px 32px -8px rgba(15, 23, 42, 0.20)`. Backdrop uses `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(8px)`.

## Shapes

The design system embraces generous, friendly rounded forms that echo modern travel accessories, smooth luggage tags, and aerodynamic contours.

### Shape Tiers
- **Micro Radii (`rounded-sm` / 4px):** Checkbox boxes and micro badge indicators.
- **Component Radii (`rounded-lg` / 16px):** Form input fields, boarding pass teardrop cutouts, and checklist card rows.
- **Card Radii (`rounded-xl` / 24px):** Primary trip status cards, timeline nodes, bottom sheet containers, and active flight ticket cards.
- **Full Pill (`rounded-full` / 9999px):** Quick-action tool buttons (Currency, Phrasebook, Expenses), filter chips, airport flight badges, and user avatar rings.

## Components

All components are configured for bidirectional layout safety, rendering natively under `dir="rtl"`.

### 1. Buttons
- **Primary Action (Sunset Terracotta):** `#EA580C` background, `#FFFFFF` text, `rounded-full` or `rounded-xl`. High-hit target (`h-12` / 48px min height). Bold label, subtle active press scale (`transform: scale(0.98)`).
- **Secondary Action (Maritime Outlined):** Pure white background with `1.5px solid #0284C7`, text `#0284C7`.
- **Ghost/Tertiary:** No border, transparent background, `#0369A1` text with soft ripple on tap.

### 2. Quick-Action Tool Pills
- Pill-shaped tags (`rounded-full`, height 36px) placed in horizontal scrollable carousels.
- Background `#F1F5F9`, text `#0F172A`, icon leading on the right side.
- Active state transitions background to `#0284C7` with white text and a soft blue glow. Used for: *המרת מטבע (Currency)*, *שיחון (Phrasebook)*, *ניהול הוצאות (Expenses)*.

### 3. Trip Status & Flight Boarding Cards
- Pure white container (`#FFFFFF`) with `rounded-xl` (24px) corners and Level 2 elevation.
- **Boarding Pass Variant:** Features notched semi-circular cutouts on left and right borders with a dashed divider line (`border-dashed border-slate-200`).
- Origin and destination codes rendered in tabular, bold type (`TLV` ➔ `JFK`). The aircraft glyph rotates 180 degrees to face left, aligning with the chronological direction of travel in Hebrew.
- Real-time status tags (e.g., "בזמן", "מתעכב") use green (`#059669`) or orange (`#EA580C`) pills positioned at the top-left card corner.

### 4. Day Planner Timeline Nodes
- Continuous vertical axis running along the **right margin** of the container (`right: 24px`).
- Node pins consist of an outer circle (`28px`, `#E0F2FE`) housing an inner active dot (`12px`, `#0284C7`).
- Event cards sprout to the left of the timeline with a connector stroke, displaying scheduled time on the right edge and activity descriptions flowing leftward.

### 5. Packing Checklist Items
- Minimum row height of 52px for finger tap accuracy.
- Rounded checkboxes (`rounded-md`, 20px) positioned on the **far right edge**.
- Checked state fills with `#059669`, animating a crisp white checkmark accompanied by a subtle strike-through across the Hebrew label text (`#94A3B8`).

### 6. AI Chat Assistant Bubbles
- **AI Concierge Bubbles:** Nested on the **right side**, styled with `#F1F5F9` background, `#0F172A` text, and rounded corners with a bottom-right flattened anchor (`rounded-2xl rounded-br-sm`). Includes an ocean blue spark indicator.
- **User Request Bubbles:** Nested on the **left side**, styled with `#0284C7` background, pure white text, and a flattened bottom-left anchor (`rounded-2xl rounded-bl-sm`).