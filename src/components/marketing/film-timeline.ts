// The hero film's timeline. Scroll progress runs 0 → 1 across the pinned
// stage; every moment of the film is a window on that line, named here so
// a chapter can be stretched or moved in one place.
//
//   Fade  = [inStart, inEnd, outStart, outEnd]  → opacity 0, 1, 1, 0
//   Move  = [start, end]                         → a value travelling once
//
// Seven chapters: the five about the customer and the team take the first
// ~64% of the film at the pace they always had; the card's anatomy (stamp
// card, then coupon) takes the rest. Chapters are separated by a short
// breath where only the phone is on screen.

export type Fade = readonly [number, number, number, number]
export type Move = readonly [number, number]
/** Keyframes on progress: `values[i]` at `keys[i]`, interpolated between. */
export type Keyframes = { keys: readonly number[]; values: readonly number[] }

export const CHAPTERS = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7"] as const
export type Chapter = (typeof CHAPTERS)[number]



/** How long the stage stays pinned, in viewport heights. The story plays
 *  over (PIN_VH − 100)vh of scroll, so 1000 gives nine screens for seven
 *  chapters; each notification still holds ~4.5% of the film (~360px at
 *  900px tall). Raise it to slow the film down, lower to speed up. */
export const PIN_VH = 1000

export const FILM = {
  /** The opening: the phone fills the fold at 1.5× and pulls back to its
   *  stage size as the first scroll happens; "keep scrolling" on phones.
   *  On desktop it also sits higher at the open (`--lift`, computed in CSS
   *  from the viewport height) and settles to the centre over the same
   *  window. */
  intro: {
    fade: [0, 0, 0, 0.045] as Fade,
    pullBack: [0, 0.077] as Move,
  },

  /** 1. The counter QR in the camera (or the email — in the copy). A hard
   *  cut from the lock screen, as iOS does. */
  ch1: {
    caption: [0.045, 0.085, 0.115, 0.14] as Fade,
    captionLag: 0.013,
    /** Where the rail lands a jump to this chapter. */
    landAt: 0.085,
    camera: [0.058, 0.075, 0.129, 0.155] as Fade,
    scanFrame: [0.064, 0.129] as Move,
  },

  /** 2. The pass slides into Wallet; the Add to Wallet buttons under the caption. */
  ch2: {
    caption: [0.14, 0.175, 0.213, 0.245] as Fade,
    captionLag: 0.013,
    landAt: 0.175,
    wallet: [0.129, 0.155, 0.213, 0.245] as Fade,
    passRise: [0.135, 0.2] as Move,
    buttons: [0.17, 0.2, 0.213, 0.245] as Fade,
    buttonsRise: [0.17, 0.2] as Move,
  },

  /** 3. Lock screen; a customer walks into the geofence, the banner drops. */
  ch3: {
    caption: [0.277, 0.322, 0.425, 0.457] as Fade,
    captionLag: 0.023,
    landAt: 0.322,
    map: [0.27, 0.31, 0.425, 0.451] as Fade,
    mapRise: [0.27, 0.33] as Move,
    walk: [0.28, 0.318] as Move,
    pulse: [0.312, 0.345] as Move,
    banner: [0.322, 0.345, 0.425, 0.451] as Fade,
    bannerDrop: [0.322, 0.35] as Move,
  },

  /** 4. The owner writes a notice; it flies to the phone and lands. */
  ch4: {
    caption: [0.483, 0.522, 0.592, 0.618] as Fade,
    captionLag: 0.013,
    landAt: 0.522,
    card: [0.477, 0.509, 0.592, 0.612] as Fade,
    cardSlide: [0.477, 0.502] as Move,
    message: [0.499, 0.509, 0.522, 0.531] as Fade,
    flight: [0.502, 0.528] as Move,
    banner: [0.528, 0.547, 0.592, 0.612] as Fade,
    bannerDrop: [0.528, 0.554] as Move,
    crowd: [0.535, 0.56, 0.592, 0.612] as Fade,
    crowdSpread: [0.535, 0.567] as Move,
  },

  /** 5. The team app, with the store badges. */
  ch5: {
    caption: [0.615, 0.63, 0.7, 0.725] as Fade,
    captionLag: 0.007,
    landAt: 0.63,
    app: [0.615, 0.625, 0.7, 0.725] as Fade,
    appRise: [0.615, 0.628] as Move,
    badges: [0.625, 0.638, 0.7, 0.725] as Fade,
    badgesRise: [0.625, 0.638] as Move,
  },

  /** 6. The stamp card, up close: it rises into Wallet, the stamps land
   *  one by one with the scroll, the reward lights up, and its parts are
   *  called out. */
  ch6: {
    caption: [0.715, 0.745, 0.86, 0.885] as Fade,
    captionLag: 0.013,
    landAt: 0.745,
    wallet: [0.70, 0.725, 1.5, 1.6] as Fade, // the screen stays through ch6
    passRise: [0.705, 0.745] as Move,
    /** `visits` 0 → 5 over this window: four stamps, then the reward. */
    stamps: [0.755, 0.805] as Move,
    calloutsFrom: 0.805,
    calloutStep: 0.011,
    /** The card turns over into the coupon. */
    flipOut: [0.875, 0.895] as Move,
  },

  /** 7. The coupon: the other side of the card, and the film's last frame. */
  ch7: {
    caption: [0.885, 0.91, 1.5, 1.6] as Fade, // never leaves
    captionLag: 0.01,
    landAt: 0.91,
    flipIn: [0.895, 0.915] as Move,
    calloutsFrom: 0.915,
    calloutStep: 0.011,
  },

  /** The lock screen is under everything in the intro, chapter 2 and 3. */
  lock: {
    opacity: { keys: [0, 0.039, 0.058, 0.219, 0.245, 0.605, 0.618], values: [1, 1, 0, 0, 1, 1, 0] } as Keyframes,
    /** When the status bar reads white-on-dark. */
    isOn: (p: number) => p < 0.05 || (p > 0.232 && p < 0.612),
  },

  /** The phone as an object: rotation under 20°, the camera's zoom, and on
   *  desktop a slide to the right of the stage whenever a caption or a card
   *  needs the left; it comes back to the centre for the card chapters. */
  phone: {
    rotateY: { keys: [0, 0.052, 0.155, 0.245, 0.296, 0.451, 0.49, 0.618, 0.644], values: [0, -18, 0, 0, 12, 12, 0, 0, 0] } as Keyframes,
    rotateX: { keys: [0, 0.155, 0.296, 0.49, 0.618], values: [0, 4, -3, 0, 0] } as Keyframes,
    /** The camera. Wide at the open (1.5×, pulling back over the intro),
     *  then a push-in on each chapter's climax — the pass in Wallet, the
     *  proximity banner, the announcement, the app — and wide again for the
     *  transitions. Chapter 3 stays a touch smaller so the crowd shows. The
     *  card chapters hold a close-up so the pass reads. */
    zoom: {
      keys: [0, 0.077, 0.129, 0.167, 0.213, 0.245, 0.322, 0.35, 0.425, 0.451, 0.49, 0.528, 0.554, 0.592, 0.612, 0.625, 0.7, 0.745, 1],
      values: [1.5, 1, 1, 1.25, 1.25, 1, 1, 1.22, 1.22, 1, 0.94, 0.94, 1.12, 1.12, 0.96, 1.1, 1.1, 1.3, 1.3],
    } as Keyframes,
    /** Phones: a smaller open and gentler push-ins (the captions sit right
     *  under the phone). */
    zoomNarrow: {
      keys: [0, 0.077, 0.129, 0.167, 0.213, 0.245, 0.322, 0.35, 0.425, 0.451, 0.49, 0.528, 0.554, 0.592, 0.612, 0.625, 0.7, 0.745, 1],
      values: [1.3, 1, 1, 1.1, 1.1, 1, 1, 1.1, 1.1, 1, 1, 1, 1.08, 1.08, 1, 1.05, 1.05, 1.1, 1.1],
    } as Keyframes,
    /** x as a function of (shift, side): shift puts the phone right of the
     *  captions, side moves it a little further when a card sits beside it;
     *  0 is the centre, where the card chapters play. */
    x: {
      keys: [0, 0.064, 0.167, 0.245, 0.296, 0.451, 0.49, 0.605, 0.638, 0.7, 0.745, 1],
      values: (shift: number, side: number) => [0, shift, shift + side, shift + side, shift - 30, shift - 30, shift + side, shift + side, shift, shift, 0, 0],
    },
    shift: 240,
    side: 56,
    /** Phones: the phone steps left for the map chapter so the pin, the
     *  fence and the customer's last steps show in the right gutter. */
    xNarrow: { keys: [0.27, 0.3, 0.451, 0.49], values: [0, -60, -60, 0] } as Keyframes,
    /** Where the map's centre sits, right of the phone's centre, on phones. */
    mapOffsetNarrow: 130,
    /** Background layers drift the other way for depth. */
    parallax: 40,
  },

  /** Where "Try it" links land: chapter 1 with the pass in Wallet. */
  tryDemoAt: 0.193,
  /** Where "Cards" links land, and from where the nav marks them on. */
  cardsAt: 0.745,

  /** Which chapter is on, for the live region and the rail. */
  chapterAt: (p: number): Chapter | null =>
    p < 0.045 ? null : p < 0.13 ? "ch1" : p < 0.258 ? "ch2" : p < 0.47 ? "ch3" : p < 0.615 ? "ch4" : p < 0.715 ? "ch5" : p < 0.885 ? "ch6" : "ch7",
} as const

