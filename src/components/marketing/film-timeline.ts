// The hero film's timeline. Scroll progress runs 0 → 1 across the pinned
// stage; every moment of the film is a window on that line, named here so
// a chapter can be stretched or moved in one place.
//
//   Fade  = [inStart, inEnd, outStart, outEnd]  → opacity 0, 1, 1, 0
//   Move  = [start, end]                         → a value travelling once
//
// Chapters are separated by a ~4% breath where only the phone is on screen.

export type Fade = readonly [number, number, number, number]
export type Move = readonly [number, number]
/** Keyframes on progress: `values[i]` at `keys[i]`, interpolated between. */
export type Keyframes = { keys: readonly number[]; values: readonly number[] }

/** How long the stage stays pinned, in viewport heights. The story plays
 *  over (PIN_VH − 100)vh of scroll, so 680 gives ~5.8 screens; the push-ins
 *  carry the drama, so the film needs less scroll than it used to. Each
 *  notification still holds ~7% of the film (~360px at 900px tall). Raise
 *  it to slow the film down, lower to speed up. */
export const PIN_VH = 680

export const FILM = {
  /** The opening: the phone fills the fold at 1.5× and pulls back to its
   *  stage size as the first scroll happens; "keep scrolling" on phones.
   *  On desktop it also sits higher at the open (`--lift`, computed in CSS
   *  from the viewport height) and settles to the centre over the same
   *  window. */
  intro: {
    fade: [0, 0, 0, 0.07] as Fade,
    pullBack: [0, 0.12] as Move,
  },

  /** 1. The counter QR is scanned, the pass slides into Wallet. */
  ch1: {
    caption: [0.07, 0.14, 0.31, 0.37] as Fade,
    captionLag: 0.02,
    /** Where the rail lands a jump to this chapter. */
    landAt: 0.14,
    camera: [0.06, 0.12, 0.2, 0.26] as Fade,
    scanFrame: [0.1, 0.2] as Move,
    wallet: [0.2, 0.26, 0.33, 0.38] as Fade,
    passRise: [0.22, 0.34] as Move,
    buttons: [0.26, 0.31, 0.33, 0.38] as Fade,
    buttonsRise: [0.26, 0.32] as Move,
  },

  /** 2. Lock screen; a customer walks into the geofence, the banner drops. */
  ch2: {
    caption: [0.43, 0.5, 0.66, 0.71] as Fade,
    captionLag: 0.035,
    landAt: 0.5,
    map: [0.42, 0.5, 0.66, 0.7] as Fade,
    mapRise: [0.42, 0.54] as Move,
    walk: [0.44, 0.54] as Move,
    pulse: [0.53, 0.6] as Move,
    banner: [0.55, 0.59, 0.66, 0.7] as Fade,
    bannerDrop: [0.55, 0.6] as Move,
  },

  /** 3. The owner writes a notice; it flies to the phone and lands. */
  ch3: {
    caption: [0.75, 0.81, 0.92, 0.96] as Fade,
    captionLag: 0.02,
    landAt: 0.81,
    card: [0.74, 0.79, 0.92, 0.95] as Fade,
    cardSlide: [0.74, 0.78] as Move,
    message: [0.775, 0.79, 0.81, 0.825] as Fade,
    flight: [0.78, 0.82] as Move,
    banner: [0.82, 0.85, 0.92, 0.95] as Fade,
    bannerDrop: [0.82, 0.86] as Move,
    crowd: [0.83, 0.87, 0.92, 0.95] as Fade,
    crowdSpread: [0.83, 0.88] as Move,
  },

  /** 4. The exit: the team app, store badges, the phone back at the centre. */
  ch4: {
    caption: [0.955, 0.98, 1.5, 1.6] as Fade, // never leaves
    captionLag: 0.01,
    landAt: 0.98,
    app: [0.955, 0.97, 1.5, 1.6] as Fade,
    appRise: [0.955, 0.975] as Move,
    badges: [0.97, 0.99, 1.5, 1.6] as Fade,
    badgesRise: [0.97, 0.99] as Move,
  },

  /** The lock screen is under everything in the intro, chapter 2 and 3. */
  lock: {
    opacity: { keys: [0, 0.06, 0.12, 0.34, 0.38, 0.94, 0.96], values: [1, 1, 0, 0, 1, 1, 0] } as Keyframes,
    /** When the status bar reads white-on-dark. */
    isOn: (p: number) => p < 0.09 || (p > 0.36 && p < 0.95),
  },

  /** The phone as an object: rotation under 20°, the camera's zoom, and on
   *  desktop a slide to the right of the stage whenever a caption or a card
   *  needs the left. */
  phone: {
    rotateY: { keys: [0, 0.08, 0.24, 0.38, 0.46, 0.7, 0.76, 0.96, 1], values: [0, -18, 0, 0, 12, 12, 0, 0, 0] } as Keyframes,
    rotateX: { keys: [0, 0.24, 0.46, 0.76, 0.96], values: [0, 4, -3, 0, 0] } as Keyframes,
    /** The camera. Wide at the open (1.5×, pulling back over the intro),
     *  then a push-in on each chapter's climax — the pass in Wallet, the
     *  proximity banner, the announcement, the app — and wide again for the
     *  transitions. Chapter 3 stays a touch smaller so the crowd shows. */
    zoom: {
      keys: [0, 0.12, 0.2, 0.26, 0.33, 0.38, 0.55, 0.59, 0.66, 0.7, 0.76, 0.82, 0.86, 0.92, 0.95, 0.97, 1],
      values: [1.5, 1, 1, 1.25, 1.25, 1, 1, 1.22, 1.22, 1, 0.94, 0.94, 1.12, 1.12, 0.96, 1.1, 1.1],
    } as Keyframes,
    /** Phones: a smaller open and gentler push-ins (the captions sit right
     *  under the phone). */
    zoomNarrow: {
      keys: [0, 0.12, 0.2, 0.26, 0.33, 0.38, 0.55, 0.59, 0.66, 0.7, 0.76, 0.82, 0.86, 0.92, 0.95, 0.97, 1],
      values: [1.3, 1, 1, 1.1, 1.1, 1, 1, 1.1, 1.1, 1, 1, 1, 1.08, 1.08, 1, 1.05, 1.05],
    } as Keyframes,
    /** Background layers drift the other way for depth. */
    parallax: 40,
    /** x as a function of (shift, side): shift puts the phone right of the
     *  captions, side moves it a little further when a card sits beside it. */
    x: { keys: [0, 0.1, 0.26, 0.38, 0.46, 0.7, 0.76, 0.94, 0.99], values: (shift: number, side: number) => [0, shift, shift + side, shift + side, shift - 30, shift - 30, shift + side, shift + side, shift] },
    shift: 240,
    side: 56,
  },

  /** Where "Try it" links land: chapter 1 with the pass in Wallet. */
  tryDemoAt: 0.3,

  /** Which chapter is on, for the live region. */
  chapterAt: (p: number): "ch1" | "ch2" | "ch3" | "ch4" | null =>
    p < 0.08 ? null : p < 0.4 ? "ch1" : p < 0.73 ? "ch2" : p < 0.96 ? "ch3" : "ch4",
} as const
