---
name: Akash Dasarraju
description: A résumé that doubles as a map of UT Dallas, where every orange mark is a place you can go.
colors:
  paper: "#edf0ea"
  ink: "#13221b"
  ink-2: "#3a4a42"
  muted: "#56655d"
  rule: "#cbd4cd"
  orange: "#e0650f"
  orange-ink: "#b04b04"
  night: "#0b1613"
  night-orange: "#ff8a3d"
  night-dim: "#8fa39a"
  screen: "#0b0f14"
  pin-text: "#f6f1ea"
  paper-dark: "#17241f"
  ink-dark: "#e4ece6"
  ink-2-dark: "#bac7bf"
  rule-dark: "#3f584c"
  paper-dark-muted: "#93a299"
  orange-ink-dark: "#ff9d5c"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(56px, 8.4vw, 118px)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.045em"
    fontVariation: "\"opsz\" 96"
  headline:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 40px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Bricolage Grotesque, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  tag: "4px"
  control: "7px"
  pin: "8px"
  button: "10px"
  panel: "12px"
  card: "16px"
  plate-mobile: "20px"
  plate: "28px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter: "32px"
  card-gap: "18px"
  column-gap: "56px"
  container: "1240px"
components:
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 18px 18px"
  room-chip:
    textColor: "{colors.orange-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px 3px 8px"
  room-chip-hover:
    backgroundColor: "{colors.orange}"
    textColor: "#1a0b02"
  icon-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    size: "44px"
  resume-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 16px 0 13px"
  map-pin:
    backgroundColor: "{colors.night}"
    textColor: "{colors.pin-text}"
    rounded: "{rounded.pin}"
    padding: "7px 13px 8px"
  map-pin-hover:
    backgroundColor: "{colors.night-orange}"
    textColor: "#1a0b02"
  button-play:
    backgroundColor: "{colors.night-orange}"
    textColor: "#1a0b02"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-ghost:
    textColor: "#e8eef3"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  tour-button:
    backgroundColor: "{colors.night}"
    textColor: "#e9efe9"
    rounded: "6px"
    padding: "8px 14px"
---

# Design System: Akash Dasarraju

## Overview

**Creative North Star: "Field Map"**

The site is a résumé that is also a map. You read it on cool, green-grey paper in deep green ink. Every orange mark on it is a place you can go: a phrase that opens a tour, a pin on the campus plate, a chip that walks you into the room where the work happened. Underneath the paper is UT Dallas at night, a dark plate in the hero where buildings draw themselves in teal line and the visitable ones glow orange. Inside the tour, that night takes the whole screen.

The paper side is calm and editorial, with plain section headings and a tall, tight display face. The night side is instrumental: monospace readouts, canvas "monitors" with live charts, and a HUD with a blinking cursor. The two halves don't blend. You are either reading the map or standing in the place.

The density is moderate. One wide container, a sticky-heading résumé grid, and six work cards whose tops are live screens. Motion is purposeful and staged: the plate draws in, the pins pop in one by one, entries rise as you reach them, and a scan line sweeps the plate now and then. Reduced motion turns all of it off.

**Key Characteristics:**
- Two worlds: daylight paper for reading, campus-at-night for being there.
- Orange means "you can go here". It's a wayfinding signal, not decoration.
- One typeface, Bricolage Grotesque, for everything: tall and tight for the name, plain at reading sizes.
- Live canvas screens instead of screenshots.
- Cards as the record: each project lives once, with its detail one click down.

## Colors

Muted green neutrals carry the reading. A single orange, in two strengths, carries the wayfinding. Near-black greens and blues carry the night.

### Primary
- **Signal Orange** (`orange`): the "go there" color on paper. Used for underlines on tour phrases, the pin icons in chips and cards, the fill of a hovered chip (with near-black text), focus rings, and card borders on hover.
- **Burnt Signal** (`orange-ink`, `orange-ink-dark` in dark mode): the text-strength orange, dark enough to read on paper. Used for link text in tour phrases, chips and the cards' demo line, and for the contact email.
- **Night Beacon** (`night-orange`): the orange of the night world. Used for map pins and buildings you can visit, the HUD readout, game buttons and meters, and the hello bubble's border.

### Neutral
- **Field Paper** (`paper`): the page background. A cool, slightly green off-white, never pure white.
- **Forest Ink** (`ink`): headings, body text, and the 2px section rules.
- **Moss Ink** (`ink-2`): secondary body text, such as the intro and card blurbs.
- **Lichen** (`muted`): metadata, dates, footnotes and skill labels. Darkened to pass 4.5:1 on paper.
- **Hairline Sage** (`rule`): card borders, the top-bar border, and resting underlines.
- **Campus Night** (`night`): the hero plate, the hello bubble, and the tour backdrop.
- **Night Sage** (`night-dim`): quiet text on night surfaces, such as status lines.
- **Monitor Black** (`screen`): the canvas monitors, the hover peek, and card shots. It is bluer than the night, the way a screen is.
- **Dark mode** (`paper-dark`, `ink-dark`, `ink-2-dark`, `orange-ink-dark`): with `prefers-color-scheme: dark` or `data-theme="dark"`, paper and ink invert to these values and the orange brightens.
- **Pin Cream** (`pin-text`): place names on the night plate's pins.

The canvas screens have their own instrument palette in `src/screens/kit.js` (blue, cyan, green, red, yellow, purple, pink, plus a screen orange). It is for data series only and never appears in page chrome.

### Named Rules
**The Go-There Rule.** Orange marks only things that take you into a room or a demo: tour phrases, room chips, the cards' demo line, map pins, play buttons, focus rings, and the contact email. If clicking it does nothing, it isn't orange. Labels are grey.

**The Two Oranges Rule.** On paper, link text uses Burnt Signal and strokes and fills use Signal Orange. On night surfaces, everything uses Night Beacon. Never put Signal Orange text on paper; it fails contrast.

## Typography

**Display font:** Bricolage Grotesque (fallback: Helvetica Neue, Arial)
**One face for everything:** Bricolage Grotesque (fallback: Helvetica Neue, Arial), at every size from the name to the labels, with tabular figures so numbers line up. The room screens' terminals and code are the one exception: they stay in JetBrains Mono.

**Character:** Bricolage's variable optical size does the work: tall and compressed for the name, open and plain at reading sizes, so one family carries the whole page.

### Hierarchy
- **Display** (800, clamp 56–118px, line-height 0.86, opsz 96): the name in the hero only. It is set on two lines, with the second line indented 0.42em on desktop.
- **Headline** (700, clamp 28–40px, line-height 1.08): section heads such as "Work" and the résumé section titles (28px, sticky). The contact headline goes up to 56px.
- **Title** (600, 21–22px, line-height 1.2–1.25): card titles and résumé entry titles.
- **Body** (400, 17px, line-height 1.6): résumé text, with bullets capped at 68ch. The intro is 18–20px in Moss Ink.
- **Ask** (Bricolage 600, 19–23px): the one line under the name that says what you're looking for.
- **Label** (mono 500, 12–13px, letter-spacing 0.1–0.14em, uppercase): only in the tour, for the HUD and room-title kickers.

### Named Rules
**The One Face Rule.** Everything on the page and in the tour UI is Bricolage Grotesque; hierarchy comes from size, weight, tracking and case, never from a second family. Only the room screens' terminals and code stay monospace.

**The Tight Display Rule.** Display and headline faces always carry negative tracking (−0.015 to −0.045em). Larger text gets tighter tracking.

## Layout

There is one centred container, 1240px wide, with 32px gutters on desktop and 16px at 880px and below.

- **Hero:** a two-column grid (1fr / 1.1fr). On the left: name, the ask, the contact row (icons plus the résumé button), the intro (which leads with the strongest result and links the projects in orange), and the orange-link hint. On the right: the night plate (square, at most 80vh). No eyebrow above the name. Below 880px it stacks as name, ask, contact, intro, hint; the plate moves (in main.js) to sit between the Projects and Research rows, so the proof comes first and the map becomes the way into the rooms.
- **Landmarks:** a skip link ("Skip to the work") jumps to `<main id="content">`, which holds Projects, Research and the résumé sections (`.resume`); each card's "Details" carries hidden text naming its project.
- **Projects and Research:** the cards *are* these sections; the résumé below keeps only Leadership, Education and Skills. Projects is a row of three cards; Research is a row whose first column is a plain lab note (lab, advisor, dates, one sentence) followed by two cards. Cards align to the top so an opened card doesn't stretch its neighbours. Two columns between 881 and 1100px; one below 880px, where the shot becomes a 16:7 strip above the text.
- **Résumé:** each section is a two-column grid, a 240px sticky heading beside a content column of at most 780px, with a 56px column gap. Sections are separated by a 2px Forest Ink rule. On mobile the heading sits above the content and stops being sticky.
- **Top bar:** slides in after the hero is scrolled past, and is hidden from the tab order until then. It is fixed and uses translucent paper with a 10px blur. Section links on the left, the résumé button and an email icon on the right. On mobile the section links scroll sideways and the résumé and email stay put.
- **Tour:** fullscreen. The explanation panel is fixed to the left (`--brief-w: min(370px, 30vw)`), and the HUD and flat screen sit beside it.

Vertical rhythm is generous between sections (44–64px) and tight inside entries (4–12px).

## Elevation & Depth

On paper the design is flat and uses rules; depth exists only as a response to state. In the night world, depth is glow: orange light, not grey shadow.

### Shadow Vocabulary
- **Plate** (`inset 0 0 0 1px #1d302a, 0 30px 60px -30px rgba(9,22,18,.55)`): the hero map. It is the only resting shadow on the paper side.
- **Card lift** (`0 24px 40px -26px rgba(224,101,15,.7)`, with translateY(-3px)): card hover and focus. It is an orange-tinted under-glow.
- **Beacon glow** (`0 0 18px -4px rgba(255,122,34,.6)`, drop-shadow on buildings): map pins, hot buildings, and the hello avatar.
- **Floating panel** (`0 24px 50px -20px rgba(0,0,0,.8)`): the hover peek and the hello bubble, things that float above the page.

### Named Rules
**The Lit-Not-Lifted Rule.** At night, emphasis is light (orange glow and text-shadow), never a grey drop shadow.

## Shapes

The corners are softly rounded and scale with the size of the surface:
- tags: 4px
- controls: 6–7px
- pins: 8px
- panels: 10–12px
- cards: 16px
- the plate: 28px (20px on mobile)

Room chips are full pills. Borders are 1.5px wherever they carry meaning (cards, chips, pins, the hello bubble), and 1px for hairlines. Explanation call-outs in games use a 3px Night Beacon left bar, squared on that side. Map building outlines draw in with stroke-dash animation and stay as line work, not filled shapes, unless they can be visited.

## Components

### Work Cards
*Specimen boxes with a live instrument on top.*
- **Shape:** 16px corners and a 1.5px Hairline Sage border.
- **Structure:** an `<article>` in two parts. The top (live canvas "shot", 16:9.6, Monitor Black; a display title; one sentence in Moss Ink with the single result in bold Forest Ink; a "Play: …" line in Burnt Signal) is one link to the tour, stretched over the top half from the title. Below it, a `<details>` "Details and code" (44px summary, chevron) holds the meta line with GitHub/site/Colab links and the full bullets.
- **Readout:** one big number or short phrase from the card's own work (never a bare venue name: "Targeting CVPR", with "paper in preparation, not yet submitted" beneath) sits over the bottom of the shot on a dark fade (Bricolage 700, 26px, with a one-line caption), so the card proves something even though the screen behind it is too small to read.
- **Title:** ink, with a 2px underline at 50% Signal Orange at rest (it goes somewhere), full orange on hover.
- **Hover/focus:** hovering or focusing the top turns the border Signal Orange, lifts the card 3px with the card-lift glow, underlines the demo line, and fades in a small "live" tag on the shot. The details summary has its own quieter hover.
- **One label per demo.** The "Play: …" line, any room chip, and the game's title in the tour use the same words (from `content.js`).

### Room Chips
*The "walk into the room" pill beside a résumé entry, named for the demo it opens.*
- **Resting:** a pill with a 1.5px border at 55% Signal Orange, Burnt Signal text, and a small orange pin icon.
- **Hover/focus:** filled Signal Orange with near-black text and icon (#1a0b02). White on orange fails contrast.

### Contact Row
*Icons for the address book, words for the résumé.*
- **Icon links** (email, GitHub, LinkedIn): 44px squares with 10px corners, a 1.5px Hairline Sage border and Forest Ink glyphs. On hover/focus the border goes Forest Ink with a 6% ink wash. Each has an `aria-label` and a `title`.
- **Résumé button:** a solid Forest Ink pill-ish button (10px corners, 44px tall) with a document icon and "Résumé (PDF)" in paper color. It's the only filled button on the paper side.
- The contact section keeps the email as a large written address (it's the call to action), followed by the same icon row.

### Tour Phrases
*Inline wayfinding inside prose.*
- **Resting:** Burnt Signal, weight 600, and a 2px underline at 45% orange, followed by a small pin icon.
- **Hover:** the underline goes solid and a faint 10% orange wash appears behind the text.

### Map Pins
*Beacons on the night plate.*
- **Resting:** a Campus Night chip (88% opacity) with a 1.5px Night Beacon border, the place name above a small sage sub-line, and the beacon glow.
- **Hover, focus or linked hover:** fills Night Beacon with near-black text, and its building on the plate lights up.
- **Entrance:** pops in with a slight overshoot, staggered per pin.

### Buttons (night world)
- **Play:** solid Night Beacon with near-black text (#1a0b02), 7px corners, 9px × 14px padding.
- **Skip ahead:** the same solid Night Beacon fill in the tour bar, so the way past the flight is the most visible control.
- **Ghost:** transparent with a 1px white-30% border and light text.
- **Tour bar:** translucent night with a 6px blur and a light border that brightens on hover.

### Explanation Panel (tour brief)
A dark, glassy column (6px blur, rgba(6,10,18,.55–.74) gradient, 12px corners). It appears as soon as the room's screen exists, over the flight. Order: kicker (kind and years), title (the card's own name), the lede's first sentence, then the game: its title, **one recorded run** (a real result table from running the game once on this site's model, with a one-line note), the "Play it yourself (85 MB download)" button, the pitch and a small model note. Then a two-sentence "My part", a folded "How it works" (`<details>`; or the tour's own heading, e.g. "What I do") holding the rest of the lede and the steps, and a footer with "Also in this room" pills (the room's other tours) and an email/résumé line. Phones keep the same order in a sheet up to 58vh tall, with the recorded table trimmed to its winning row so Play is in view. Personal projects say "Personal project" in the kicker, so a room never implies the lab owns them. The panel is a flat 88% night so it reads over bright rooms. Recorded runs are never invented: re-record them if a game changes. Its numbered steps use mono counters in 18px squares; the active step lights up. The game block below is outlined in 45% Night Beacon on a 7% orange wash.

### Tour Motion
Every tour flies in: warp, campus flyover, through the wall, the decoding room title, the walk to the screen. "Skip the flight" (solid orange) jumps to the room, and the brief is up from the start on an 88% night panel so there is something to read over the city. Moving to another tour in the same room (the "Also in this room" pills) goes straight there and replaces the history entry rather than adding one. The brief ends with those pills and an email/résumé line. While a tour is open, the page behind it is `inert`, focus starts on "Back to the page" and moves to the brief's title on arrival, and the dialog is named "Tour: <title>". The decoding room title is hidden from screen readers; the hello's typed words are too, with the full sentence announced once.

### Intro (src/boot.js)
Once a visit (sessionStorage), never with reduced motion, without WebGL, or on a deep link into a tour. About 24 s (the film runs at a third speed; a skip plays the break-through at full speed): a short film cut from seven models built in Blender (`tools/build_intro.py` → `public/intro/intro.glb`, each under an empty named for it), rendered in three.js with ACES tone mapping, a room environment for the metal, orange rim and cyan fill lights, fog, a survey-grid floor, drifting dust and bloom. Over it, on a 2D canvas, the HackUTD Zero Day intro's language: an RGB split and tearing on the opening and the break, scanlines, scrambling type, all Bricolage.

The shots don't cut, they dissolve. Through each change (0.84 s, centred on the cut) an orange scan plane, a faint grid with a bright rim, sweeps across the subject and the solid behind it is clipped away; what was there leaves as square pixels sampled from the model's surface (7,000 per model, coloured by its material, sorted along the sweep so each lands on the part of the next model across from it), arcs over, and lands as a cyan plane a beat behind builds the next subject. The camera glides from one shot's end to the next shot's start, pulling back mid-change so both models are whole. The next model shows first as a flickering cyan wireframe ahead of its build, and the last one's wireframe lingers a moment where the cut has passed; through the middle of each change, bands of the frame slip sideways and break into blocks. The subjects are the card, the chip, the network, the stopwatch and the card again. The film opens the same way: the card builds out of a storm of pixels in the dark behind it. Whatever flies leaves light trails (an afterimage pass, through the changes, behind the memory sticks and in the dive). The floor is live: packets of orange light race down some of the grid's lines, and as each subject locks, a cyan ring ripples out along the lines from under it while a shockwave bends the frame outward from it (a bigger one from the hub as the camera dives). Once a subject is built, a reticle (corner brackets, a crosshair, a turning dashed ring, a sweep line and ticks) closes in on its middle, white while it locks and orange once it has. In the finale the name builds out of pixels streaming from the fan's hub, then snaps to type.
- **open:** a cursor while the models load; then close across the graphics card's spinning fans and fins as its light strip flickers on.
- **INFERENCE:** a GPU package (lit traces on a dark die) turns in the middle; memory sticks streak past the lens, one near, one far; the card sits behind.
- **RESEARCH:** the camera flies alongside a neural network whose layers fire in turn, over a causal attention pattern rising out of the floor as columns.
- **EFFICIENCY:** a stopwatch, its hand racing; a speed gauge swings in with its needle slamming to the top.
- **finale:** back to the card; its gold fingers light, the dust pours into its fan, the camera dives into the hub as the name decodes over a dark band, and it breaks through with a flash onto the page.
Each shot's word slams onto the floor, and nothing else is written over the shots. The models are bevelled and smooth-shaded so their edges catch the light. The camera has depth of field focused on each shot's subject (things passing the lens go soft), a handheld drift and a speed ramp (in fast, slow on the subject, out fast); the frame is graded under a dark sky dome with an ember line at the horizon, then finished with light shafts streaming from just behind the subject (from the fan's hub in the finale, where they swell), a split-tone grade (teal shadows, warm highlights), a faint gate weave, chromatic aberration toward the edges, a vignette, grain and anamorphic streaks off anything bright. Each shot opens with a rack focus onto its subject, each word lands with a jolt, and warm light leaks drift in from the edges through every change. It's framed as film: letterbox bars that close in at the signal and open as the camera dives through, the shot number and name and a running timecode in them, speed lines that surge a little on each change and hard in the dive, and a slight Dutch roll on the fly-past shots. Emissive strengths are tuned in the intro for each shot's distance so nothing blows out. The world borrows from TRON: Legacy's titles. Light cycles race along the floor's grid lines, turning hard at the corners and leaving translucent light walls with bright rims (orange and cyan) that fade behind them. A wireframe city of tower outlines, with a scatter of lit windows, rings the horizon far out in the haze, so the models sit in a place rather than a void. Over it a storm (after TRON: Ares): clouds drift through a grid drawn on the sky, which glows where the clouds touch it, and now and then lightning flickers inside them. Searchlights rise out of the city and sweep slowly through the haze (after Blade Runner). The previous shot's word stays faintly burned into the frame in cyan as the next slams in, like a worn screen (after Blade Runner 2049's screens). In the dive, past the fan, a tesseract (after Interstellar's): a corridor of amber lattice frames rushing at the lens, lit unevenly and flickering as if by projectors, behind the name. Inside the shots: current races along the chip's traces as bright bands; in the network, square-pixel signals run down every link from layer to layer as the layers fire; once a subject has locked, two dashed rings of pixels (orange and cyan) orbit it on different tilts, and the camera punches in a little at the lock. A dirty lens (smudges, specks, a few hexagonal bokeh rings) lights up whenever the frame turns bright. In the finale, before the fan draws everything in, there's bullet time: the fans stop dead, the dust hangs, even the grain holds, the colour drains to a cold grey, ghosts of the frame stand either side, and the camera whips a quarter of the way round the card before time snaps back for the dive. At the break-through the last frame shatters: it splits into tiles that fly out from the fan toward the lens with burning edges, at full speed, and the page is already there behind them. A click, key, wheel or touch skips to the break-through. While it runs, `html.intro-on` covers the page and holds the hero's entrance, which then plays as the intro leaves; the hello waits for it. `?intro=2.5` freezes it at 2.5 s of film time (7.5 s in) for checking a frame (and exposes the scene as `window.__intro`).

### Hello
The 3D avatar in the lower-right corner with a Campus Night speech bubble (1.5px Night Beacon border, 14px corners, a tail pointing at the avatar). While it talks, the orange links on the page pulse twice.

## Do's and Don'ts

### Do:
- **Do** use orange only for things that go somewhere or do something (the Go-There Rule).
- **Do** use Burnt Signal for orange text on paper and Signal Orange for orange strokes, fills and focus rings. Text on an orange fill is near-black (#1a0b02).
- **Do** keep the paper side light and the night side dark. Dark surfaces belong to the map plate, the canvas monitors, the hello, and the tour.
- **Do** show work as live canvas screens rather than static screenshots.
- **Do** set labels and readouts in Bricolage with tabular figures, uppercase and tracked; keep monospace for code on the room screens only.
- **Do** keep every animation behind `prefers-reduced-motion`. Under reduce, all transitions and animations go to zero.
- **Do** keep the 16px side gutter and single-column stacking at 880px and below, with every tap target at least 44px (tour buttons, pins, icons, summaries).

### Don't:
- **Don't** use orange as decoration, background or plain emphasis, including labels.
- **Don't** number sections; the headings carry the page.
- **Don't** put a kicker or eyebrow label above a heading; the heading speaks for itself.
- **Don't** say the same project twice on the page: a card is the project's only home, with its detail behind "Details".
- **Don't** let night panels drift onto the reading side as section backgrounds or dark bands.
- **Don't** use pure white (#fff) or pure black for page surfaces. Paper is Field Paper, and the night is green-black.
- **Don't** use the screens' blue, green or purple data colors in page chrome.
- **Don't** put grey drop shadows on night surfaces. Light it instead.
