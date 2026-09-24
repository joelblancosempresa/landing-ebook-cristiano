import { useEffect, useRef, useState } from 'react'
import portada from './assets/portada.png'
import contraportada from './assets/contraportada.png'
import canto from './assets/canto.png'

// Google Apps Script "Web app" URL (termina en /exec) — ver apps-script-presave.gs
// para el código del backend y cómo desplegarlo.
const PRESAVE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBaI_X_uyEGrOrMqQx-_L0ieQZs_szvM8aAFhgMW3brp_rypdvZoAWMD-_BU7LyIjV/exec'

// ─── Real 3D book box: front + back covers, spine, and page edges ──────────
// Gives the book actual thickness (like the reference video) instead of two
// flat, zero-depth planes — at ~90° you see the spine/pages, not a sliver.
//
// Every face is sized/pivoted so the seams line up exactly: front and back
// sit at z = ±D/2 spanning the full width, and the two edge faces are each
// centered ON the box's left/right boundary (not flush outside it) and spun
// around their OWN center — so after rotating they land at that same ±D/2
// span instead of drifting off by D/2, which is what caused the gaps.
const BOOK_DEPTH = 20 // px

// Realistic paper-edge texture: fine page lines + a shading gradient that
// darkens toward both sides, like light falling across a rounded page block.
const PAGE_EDGE_BG =
  'linear-gradient(to right, rgba(0,0,0,0.45), transparent 18%, transparent 82%, rgba(0,0,0,0.45)), ' +
  'repeating-linear-gradient(to bottom, #f5eed9 0px, #f5eed9 1px, #e7dcc0 1px, #e7dcc0 1.6px)'

// `openT` (0–1) hinges the front cover open around the spine (left edge),
// like an actual page turning, revealing a blank page underneath. 0 = closed
// (identical to the plain closed box), 1 = swung fully open to the left.
function Book3D({ openT = 0 }: { openT?: number }) {
  const half = BOOK_DEPTH / 2
  return (
    <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
      {/* Blank page underneath — always present, revealed as the cover opens */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${half - 1}px)`, background: 'linear-gradient(160deg, #f7f0dd, #ece2c8)' }} />

      {/* Front cover — hinged flap: portada outside, blank inside */}
      <div
        style={{
          position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
          transformOrigin: '0% 50%',
          transform: `rotateY(${-openT * 160}deg) translateZ(${half}px)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', overflow: 'hidden' }}>
          <img src={portada} alt="Portada: Cuando Dios se siente lejos" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: 'linear-gradient(200deg, #f7f0dd, #ece2c8)' }} />
      </div>

      {/* Back cover */}
      <div style={{ position: 'absolute', inset: 0, transform: `rotateY(180deg) translateZ(${half}px)`, backfaceVisibility: 'hidden', overflow: 'hidden' }}>
        <img src={contraportada} alt="Contraportada del libro" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      {/* Spine (left edge) — centered on x:0, spun around its own middle */}
      <div
        style={{
          position: 'absolute', top: 0, left: `${-half}px`, width: `${BOOK_DEPTH}px`, height: '100%',
          transform: 'rotateY(-90deg)',
          backfaceVisibility: 'hidden',
          overflow: 'hidden',
        }}
      >
        <img src={canto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      {/* Page edges (right edge) — real-looking paper stack, centered on x:100% */}
      <div
        style={{
          position: 'absolute', top: 0, left: `calc(100% - ${half}px)`, width: `${BOOK_DEPTH}px`, height: '100%',
          transform: 'rotateY(90deg)',
          backfaceVisibility: 'hidden',
          background: PAGE_EDGE_BG,
        }}
      />
    </div>
  )
}

// ─── Quote blocks shown beside the book during the rotate phase ────────────
const TEXT_BLOCKS = [
  {
    side: 'left' as const,
    text: 'Hubo un tiempo en que orar no te costaba. Abrías la Biblia y algo dentro de ti se movía. Sentías a Dios cerca sin esforzarte en sentirlo.',
  },
  {
    side: 'right' as const,
    text: 'No estás solo en esto.\nElías pidió morirse después de su mayor victoria.\nDavid llenó los Salmos de preguntas sin respuesta.\nLos discípulos durmieron en Getsemaní.\nHabacuc le preguntó a Dios hasta cuándo iba a ignorarle.\nAsaf pensó que su fe había sido un error.',
  },
  {
    side: 'left' as const,
    text: 'Tu distancia con Dios tampoco es el final de la historia. Es la parte que nadie te enseñó a atravesar.',
  },
]

const HOW_IT_WORKS_STEPS = [
  {
    title: 'La Biblia como espejo',
    text: 'Cada día empieza con alguien que ya estuvo donde estás tú. Su historia te muestra que hay salida.',
  },
  {
    title: 'Un versículo que se queda',
    text: 'No para memorizarlo. Para entender qué estaba pasando cuando se escribió. Eso lo cambia todo.',
  },
  {
    title: 'Una conversación real',
    text: 'Una frase incompleta. Tú pones el final. El día acaba con algo que decirle a Dios, aunque sean cinco palabras.',
  },
]

// Pop-up fact cards shown once the (single, persistent) book closes and settles
const FACT_CARDS = [
  { title: '21 historias reales', text: 'Personas de la Biblia que sintieron exactamente lo que sientes tú ahora.' },
  { title: '21 versículos en contexto', text: 'No para decorar. Para entender qué estaba pasando cuando se escribieron.' },
  { title: '21 retos concretos', text: 'Una sola cosa por día. Sin overwhelm, sin culpa.' },
]

// Day titles flipped through rapidly once the book has "entered" the phone
const PAGE_FLIP_ENTRIES = [
  { day: 1, title: 'Esto también es fe' },
  { day: 3, title: 'Cuando orar se siente como hablarle a una pared' },
  { day: 8, title: 'El teléfono que nunca sueltas' },
  { day: 15, title: 'Deja de esperar a sentir algo' },
  { day: 21, title: '¿Y ahora, qué?' },
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
// Fraction of [start,end] that `p` has covered, clamped to 0..1
const windowT = (p: number, start: number, end: number) => clamp01((p - start) / (end - start))

// Phase boundaries as fractions of the combined hero+quotes+open-book journey (0–1).
// One single sticky book rides through the whole thing: turns to the back cover,
// then — already turning back to the front and opening, continuously, no static
// hold — the headline + quotes scroll past behind it while it moves. Never a
// second, separate book instance.
// Expressed as vh of active scroll (out of WRAPPER_ACTIVE_VH). The remaining
// holding phases (where there's text to read with the book stopped) are given
// more scroll distance on purpose, so reaching that checkpoint takes deliberate
// scrolling.
const WRAPPER_ACTIVE_VH = 460
const HERO_END = 10 / WRAPPER_ACTIVE_VH     // static tilted beat at the very top
const BACK_END = 65 / WRAPPER_ACTIVE_VH     // rotate 0→180 (front→back) finishes here — fast
// No static hold here: the moment the back cover is reached, the book is
// already turning back to the front and opening, continuously, for as long
// as the headline + quotes are passing behind it — never sitting still.
const OPEN_START = 75 / WRAPPER_ACTIVE_VH   // front cover starts hinging open, a beat after BACK_END
const ROTATE2_END = 165 / WRAPPER_ACTIVE_VH // rotate 180→360 (back→front) finishes here, fully open — synced with the quotes clearing
// Section 3 → 4: same idea again — no static hold. The moment it's fully
// open it's already closing back up, continuously, while the "21 entradas
// diarias" copy passes behind it, settling at a diagonal tilt with the front
// cover showing right as the copy clears — the 3 fact-card pop-ups fade in once it gets there.
const CLOSE_TILT_START = 175 / WRAPPER_ACTIVE_VH // the diagonal lean starts easing in a beat after ROTATE2_END
const CLOSE_END = 240 / WRAPPER_ACTIVE_VH        // fully closed and settled at its diagonal rest — synced with the copy clearing
// Section 4 → 5: the pop-ups shrink back away, the "Cómo funciona" copy
// passes behind the book while it turns and shrinks toward the phone. The
// phone itself is ordinary content again (like every other bit of copy) —
// it fades in pinned in front of the book (higher z-index), stays fixed on
// screen for the whole page-flip run, and only moves once the sticky box
// itself releases — i.e. once all pages have finished flipping.
const CARDS_SHRINK_START = 250 / WRAPPER_ACTIVE_VH
const CARDS_GONE = 275 / WRAPPER_ACTIVE_VH
const PHONE_ENTER_END = 375 / WRAPPER_ACTIVE_VH  // book fully shrunk away, phone fully revealed
const PAGE_FLIP_END = 440 / WRAPPER_ACTIVE_VH    // rapid page-flipping runs from PHONE_ENTER_END to here

// Subtle interactive parallax — mouse on desktop, device tilt on mobile.
// iOS 13+ only grants motion access after a user gesture, so we request it
// on the first touch (silently ignored on Android/desktop, where it's not needed).
function useTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setTilt({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 })
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0
      const beta = e.beta ?? 0
      setTilt({ x: clamp01((gamma + 30) / 60) * 2 - 1, y: clamp01((beta - 15) / 60) * 2 - 1 })
    }
    // Guarded: some browsers don't expose DeviceOrientationEvent at all, and
    // referencing it directly would throw and silently break this whole effect.
    const DOE = typeof DeviceOrientationEvent !== 'undefined'
      ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      : null
    const requestPermission = DOE?.requestPermission
    const onFirstGesture = () => {
      if (typeof requestPermission === 'function') {
        requestPermission()
          .then(state => { if (state === 'granted') window.addEventListener('deviceorientation', onOrient) })
          .catch(() => {})
      }
      window.removeEventListener('touchstart', onFirstGesture)
      window.removeEventListener('click', onFirstGesture)
    }
    window.addEventListener('mousemove', onMove)
    if (typeof requestPermission === 'function') {
      // iOS 13+: motion access is gated behind an explicit user gesture —
      // the listener is only attached once permission comes back granted.
      window.addEventListener('touchstart', onFirstGesture, { once: true })
      window.addEventListener('click', onFirstGesture, { once: true })
    } else {
      // Android / desktop: no permission gate, works immediately.
      window.addEventListener('deviceorientation', onOrient)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('touchstart', onFirstGesture)
      window.removeEventListener('click', onFirstGesture)
    }
  }, [])
  return tilt
}

// ─── Header bar — name + CTA, sticky above everything ──────────────────────
function Header() {
  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px clamp(20px, 4vw, 40px)',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(201,169,110,0.15)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 700 }}>
        Joel Blanco Sierra
      </span>
      <a
        href="#presave"
        style={{
          fontFamily: 'var(--font-sans)', color: '#000', background: '#c9a96e',
          fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em',
          padding: '9px 20px', borderRadius: '999px', textDecoration: 'none',
        }}
      >
        Quiero el mío
      </a>
    </div>
  )
}

// ─── Section 1 — Hero: one persistent sticky book rides through the whole
// journey. It turns to the back cover behind the title, then keeps turning
// back to the front and opening — continuously, no static hold — while the
// headline + quotes scroll past behind it. A single continuous element,
// never a second book instance. ──────────────────────────────────────────
function HeroSection() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const tilt = useTilt()

  useEffect(() => {
    const onScroll = () => {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const sectionH = el.offsetHeight - window.innerHeight
      const p = sectionH > 0 ? Math.max(0, Math.min(1, -rect.top / sectionH)) : 0
      setProgress(p)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  let rotateY = 0
  let tiltZ = -7
  let openT = 0

  if (progress < HERO_END) {
    // static tilted beat, nothing moving yet
  } else if (progress < BACK_END) {
    rotateY = lerp(0, 180, windowT(progress, HERO_END, BACK_END))
  } else if (progress < ROTATE2_END) {
    rotateY = lerp(180, 360, windowT(progress, BACK_END, ROTATE2_END)) // already turning back to the front while the quotes pass behind it
  } else {
    rotateY = 360
  }
  if (progress < OPEN_START) {
    openT = 0
  } else if (progress < ROTATE2_END) {
    openT = windowT(progress, OPEN_START, ROTATE2_END)
  } else if (progress < CLOSE_END) {
    openT = 1 - windowT(progress, ROTATE2_END, CLOSE_END) // already closing back up while the "21 entradas diarias" text passes behind it
  } else {
    openT = 0
  }

  // Interactive tilt + the settle-flat animation both fade out by BACK_END,
  // once the book is lying flat on the back cover — never skewed after that.
  const tiltFade = progress < HERO_END ? 1 : 1 - windowT(progress, HERO_END, BACK_END)
  if (progress >= HERO_END) tiltZ = lerp(-7, 0, Math.min(1, windowT(progress, HERO_END, BACK_END) * 1.4))
  tiltZ += tilt.x * 4 * tiltFade

  // Final diagonal rest, as it closes — eases in and stays (never fades back flat).
  const closeTilt = windowT(progress, CLOSE_TILT_START, CLOSE_END)
  tiltZ += closeTilt * 11
  const tiltX = -tilt.y * 5 * tiltFade - closeTilt * 5

  // The pop-up cards are pinned to the book and fade in only once it settles
  // diagonal — they should appear, not already be sitting there. They also
  // start small and grow to full size as you keep scrolling, then shrink back
  // away as the book turns off toward the phone.
  const cardsGrow = windowT(progress, CLOSE_END, CLOSE_END + 8 / WRAPPER_ACTIVE_VH)
  const cardsShrink = windowT(progress, CARDS_SHRINK_START, CARDS_GONE)
  const cardsOpacity = cardsGrow * (1 - cardsShrink)
  const cardsScale = lerp(0.4, 1, cardsGrow) * lerp(1, 0.3, cardsShrink)

  // Once the pop-ups are gone, the book spins once more and shrinks + fades
  // away — "into" the phone, which sits pinned in front of it (higher
  // z-index) the whole time, so the book visibly passes behind/under it.
  const phoneEnterT = windowT(progress, CARDS_GONE, PHONE_ENTER_END)
  rotateY += phoneEnterT * 180 // one more half turn as it shrinks off
  // The book shrinks a bit further while the pop-up cards are visible —
  // otherwise it crowds them out, overlapping both side cards at once.
  const cardsBookShrink = lerp(1, 0.78, cardsOpacity)
  const bookScale = lerp(1, 0.12, phoneEnterT) * cardsBookShrink
  const bookOpacity = 1 - windowT(progress, lerp(CARDS_GONE, PHONE_ENTER_END, 0.7), PHONE_ENTER_END)
  // The phone is always mounted — never faded in, never popped in — exactly
  // like the other passing text blocks: it's simply there, and scrolling is
  // what brings it into view, via the same kind of continuous motion normal
  // document content would have. It rides up from below into its resting
  // spot as you scroll through this stretch, arriving right as the book
  // (sitting behind it) finishes shrinking away. Pinned (same sticky box)
  // through the entire page-flip run — it only moves once the sticky box
  // itself releases, i.e. once flipping is done.
  const phoneRise = 1 - windowT(progress, CARDS_GONE, PHONE_ENTER_END)
  // The book stage sits high (13vh from the top) while there's text passing
  // below it that needs the room — but once that copy has cleared and it's
  // just the book shrinking away, it re-centers vertically instead of
  // staying stranded near the top with dead space below.
  const stageMarginVh = lerp(13, 22, windowT(progress, lerp(CARDS_GONE, PHONE_ENTER_END, 0.6), PHONE_ENTER_END))

  // Once inside the phone, scrolling flips rapidly through a few day pages —
  // an actual page turning (rotateY, hinged at the left edge like a book),
  // swapped at the midpoint when it's edge-on and invisible either way.
  const pageFlipT = windowT(progress, PHONE_ENTER_END, PAGE_FLIP_END)
  const pageFloat = Math.min(pageFlipT * PAGE_FLIP_ENTRIES.length, PAGE_FLIP_ENTRIES.length - 1)
  const pageBase = Math.floor(pageFloat)
  const pageLocalT = pageFloat - pageBase
  const pageFlipRotateY = pageLocalT < 0.5 ? lerp(0, -100, pageLocalT * 2) : lerp(100, 0, (pageLocalT - 0.5) * 2)
  const pageIndex = Math.min(PAGE_FLIP_ENTRIES.length - 1, pageLocalT < 0.5 ? pageBase : pageBase + 1)

  return (
    <div ref={wrapperRef} style={{ height: `${WRAPPER_ACTIVE_VH + 100}vh`, position: 'relative', background: '#000' }}>
      {/* Eyebrow + subtitle — ordinary scrolling content */}
      <div style={{ position: 'absolute', top: '4vh', left: 0, right: 0, textAlign: 'center', padding: '0 24px', zIndex: 4 }}>
        <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '10px', fontWeight: 300, letterSpacing: '0.42em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '8px' }}>
          ✦ &nbsp; Ebook Devocional &nbsp; ✦
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.55)', fontSize: 'clamp(12px, 1.5vw, 15px)', fontWeight: 300, maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
          Un devocional para quien siente que Dios está ahí, pero lejos
        </p>
      </div>

      {/* Title — line 1 sits behind the book (passes over as it scrolls through),
          lines 2–3 sit in front, so the book can never cover them. */}
      <div style={{ position: 'absolute', top: '58vh', left: 0, right: 0, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', color: '#ffffff', fontSize: 'clamp(22px, 4.5vw, 42px)',
            fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0,
          }}>
            21 días para volver a escuchar
          </h1>
        </div>
        <div style={{ position: 'relative', zIndex: 6 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', color: '#ffffff', fontSize: 'clamp(22px, 4.5vw, 42px)',
            fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0,
          }}>
            <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>la voz de Dios</em>
            <br />
            como antes
          </h1>
        </div>
      </div>

      {/* Headline + the 3 quotes — ordinary scrolling content: rises up from
          below right as the book reaches the back cover, while it's already
          turning back to the front and opening — then keeps rising and passes
          BEHIND the book (lower z-index) as you keep scrolling — never disappears. */}
      <div style={{ position: 'absolute', top: '120vh', left: 0, right: 0, textAlign: 'center', padding: '0 24px', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(16px, 2.4vw, 21px)', fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
            Si sientes que Dios está ahí, pero lejos, no eres el único
          </h2>
          {TEXT_BLOCKS.map((block) => (
            <p key={block.text} style={{
              fontFamily: 'var(--font-body)', color: 'rgba(245,240,232,0.6)', fontSize: 'clamp(13px, 1.6vw, 15px)',
              lineHeight: 1.6, fontStyle: 'italic', margin: 0, whiteSpace: 'pre-line',
            }}>
              {block.text}
            </p>
          ))}
        </div>
      </div>

      {/* "21 entradas diarias" copy — same idea: rises from below right as the
          book finishes opening, while it's already closing back up — passes
          behind it (lower z-index) as you keep scrolling, never disappearing. */}
      <div style={{ position: 'absolute', top: '220vh', left: 0, right: 0, textAlign: 'center', padding: '0 24px', zIndex: 1 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '10px', fontWeight: 300, letterSpacing: '0.42em', textTransform: 'uppercase', marginBottom: '14px', opacity: 0.8 }}>
            ✦ &nbsp; 21 días &nbsp; ✦
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(20px, 3.6vw, 30px)', fontWeight: 700, lineHeight: 1.25, margin: '0 auto 12px' }}>
            No tienes que sentir la fe para volver a practicarla.
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.5)', fontSize: 'clamp(12px, 1.5vw, 15px)', fontWeight: 300, maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Un versículo que no habías leído así.<br />
            Una historia que te va a costar olvidar.<br />
            Y algo concreto que hacer ese día.<br />
            Sin sermones. Sin culpa.
          </p>
        </div>
      </div>

      {/* "Cómo funciona" copy — same idea: rises from below right as the pop-ups
          shrink away, while the book turns and shrinks off toward the phone —
          passes behind it as you keep scrolling, never disappearing. */}
      <div style={{ position: 'absolute', top: '310vh', left: 0, right: 0, textAlign: 'center', padding: '0 24px', zIndex: 1 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '10px', fontWeight: 300, letterSpacing: '0.42em', textTransform: 'uppercase', marginBottom: '18px', opacity: 0.8 }}>
            ✦ &nbsp; Cómo funciona &nbsp; ✦
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: '40px' }}>
            3 pasos para volver a escuchar a Dios
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', textAlign: 'left' }}>
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.title} style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                <div style={{
                  flexShrink: 0, width: '30px', height: '30px', borderRadius: '6px',
                  border: '1px solid rgba(201,169,110,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-serif)', color: '#c9a96e', fontSize: '13px', fontWeight: 700,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(14px, 1.7vw, 17px)', fontWeight: 700, marginBottom: '5px' }}>
                    {step.title}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(245,240,232,0.55)', fontSize: 'clamp(12px, 1.4vw, 14px)', lineHeight: 1.6, margin: 0 }}>
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The book — pinned via native sticky positioning, the one thing that stays put */}
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 3, pointerEvents: 'none' }}>
        {/* Subtle radial glow, pinned with the book */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 40% at 50% 30%, rgba(201,169,110,0.04) 0%, transparent 70%)' }} />

        {/* 3 fact-card pop-ups — small accents around the book's edges, not
            covering it; fixed with the book, fade in and grow from small to
            full size only once it settles diagonal */}
        <div style={{ position: 'absolute', top: '12%', left: 0, right: 0, zIndex: 6, padding: '0 12px', opacity: cardsOpacity }}>
          <div style={{ position: 'relative', width: 'min(98%, 460px)', height: 'clamp(240px, 44vh, 320px)', margin: '0 auto', transform: `scale(${cardsScale})` }}>
            {FACT_CARDS.map((card, i) => (
              <div
                key={card.title}
                style={{
                  position: 'absolute',
                  top: `${[0, 34, 68][i]}%`,
                  left: i !== 1 ? '0%' : undefined,
                  right: i === 1 ? '0%' : undefined,
                  width: 'clamp(108px, 34vw, 135px)',
                  background: '#0a0a0a', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px',
                  padding: '10px 12px', textAlign: 'left', boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-serif)', color: '#c9a96e', fontSize: '11px', fontWeight: 700, marginBottom: '3px' }}>
                  {card.title}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.55)', fontSize: '9.5px', lineHeight: 1.4 }}>
                  {card.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The book — the phone lives outside the sticky box now, as ordinary
            content (see below); the book just shrinks + fades away in place. */}
        <div style={{ position: 'relative', marginTop: `${stageMarginVh}vh`, zIndex: 2, opacity: bookOpacity }}>
          <div
            style={{
              position: 'absolute', inset: 0, margin: 'auto',
              width: 'clamp(300px, 66vw, 460px)',
              height: 'clamp(300px, 66vw, 460px)',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,169,110,0.4) 0%, rgba(201,169,110,0.14) 42%, transparent 72%)',
              filter: 'blur(50px)',
            }}
          />
          <div style={{ perspective: '1200px', position: 'relative' }}>
            <div
              style={{
                width: 'clamp(190px, 48vw, 300px)',
                aspectRatio: '2/3',
                transform: `scale(${bookScale}) translateX(${openT * 40}%) rotateZ(${tiltZ}deg) rotateX(${tiltX}deg) rotateY(${rotateY}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <Book3D openT={openT} />
            </div>
          </div>
        </div>

        {/* The phone — always mounted, pinned in the same sticky box as the
            book, in FRONT of it (higher z-index), so the book passes
            behind/under it as it shrinks away. It doesn't fade or pop in —
            it rides up from below into place as you scroll, the same kind
            of continuous reveal normal document content would have. Stays
            put on screen for the whole page-flip run; it only moves once
            the sticky box itself releases, i.e. once all pages have
            finished flipping. */}
        <div style={{
          position: 'absolute', inset: 0, margin: 'auto', zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 'fit-content', padding: '0 24px', textAlign: 'center',
          transform: `translateY(${phoneRise * 100}vh)`,
        }}>
          <div style={{
            width: 'clamp(220px, 46vw, 280px)', aspectRatio: '9/19.5',
            border: '7px solid #1a1a1a', borderRadius: '36px',
            boxShadow: '0 0 0 1px rgba(201,169,110,0.35), 0 30px 80px rgba(0,0,0,0.6)',
            position: 'relative', overflow: 'hidden', background: '#fff', marginBottom: '32px',
          }}>
            <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '50px', height: '6px', borderRadius: '4px', background: '#1a1a1a', zIndex: 1 }} />
            {/* An actual page — plain white, hinged at the left edge like a book, flipping over rather than just the text changing */}
            <div style={{ position: 'absolute', inset: '28px 10px 16px', perspective: '500px' }}>
              <div style={{
                position: 'absolute', inset: 0, transformOrigin: 'left center',
                transform: `rotateY(${pageFlipRotateY}deg)`, transformStyle: 'preserve-3d',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '4px', backfaceVisibility: 'hidden',
                  background: '#fff', boxShadow: 'inset -10px 0 16px -14px rgba(0,0,0,0.15)',
                  padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left',
                }}>
                  <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '8px', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Día {PAGE_FLIP_ENTRIES[pageIndex].day}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', color: '#1a1a1a', fontSize: '13px', fontWeight: 700, lineHeight: 1.4 }}>
                    {PAGE_FLIP_ENTRIES[pageIndex].title}
                  </div>
                </div>
                {/* Back of the page, seen briefly mid-flip */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '4px', backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)', background: '#f4f4f4',
                  boxShadow: 'inset 10px 0 16px -14px rgba(0,0,0,0.15)',
                }} />
              </div>
              {/* Static stack of pages underneath, so it reads as a book mid-flip, not a single floating card */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '4px', background: '#eee', zIndex: -1, transform: 'translate(2px, 2px)' }} />
            </div>
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '70px', height: '3px', borderRadius: '2px', background: '#1a1a1a' }} />
          </div>

          <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '10px', fontWeight: 300, letterSpacing: '0.42em', textTransform: 'uppercase', marginBottom: '14px', opacity: 0.8 }}>
            ✦ &nbsp; Formato PDF &nbsp; ✦
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.55)', fontSize: 'clamp(13px, 1.6vw, 17px)', fontWeight: 300, maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Léelo desde tu móvil, en cualquier momento y lugar
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Offer section ──────────────────────────────────────────────────────────
function OfferSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setStatus('sending')
    try {
      await fetch(PRESAVE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ nombre, email }),
      })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div id="presave" ref={ref} style={{ background: '#000', position: 'relative', paddingTop: '24px', paddingBottom: '80px' }}>
      {/* Price card */}
      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '0 24px' }}>
        <div
          style={{
            border: '1px solid rgba(201,169,110,0.3)',
            background: 'rgba(201,169,110,0.02)',
            padding: 'clamp(28px, 5vw, 48px)',
            position: 'relative',
          }}
        >
          {/* Corner ornaments */}
          {[
            { top: 10, left: 10, borderTop: '1px solid rgba(201,169,110,0.4)', borderLeft: '1px solid rgba(201,169,110,0.4)' },
            { top: 10, right: 10, borderTop: '1px solid rgba(201,169,110,0.4)', borderRight: '1px solid rgba(201,169,110,0.4)' },
            { bottom: 10, left: 10, borderBottom: '1px solid rgba(201,169,110,0.4)', borderLeft: '1px solid rgba(201,169,110,0.4)' },
            { bottom: 10, right: 10, borderBottom: '1px solid rgba(201,169,110,0.4)', borderRight: '1px solid rgba(201,169,110,0.4)' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 16, height: 16, ...s }} />
          ))}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px, 4vw, 36px)' }}>
            {/* Book — enters the offer box */}
            <div
              style={{
                flexShrink: 0,
                width: 'clamp(130px, 18vw, 200px)',
                aspectRatio: '2/3',
                opacity: vis ? 1 : 0,
                transform: vis ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.88)',
                transition: 'opacity 0.8s ease, transform 0.8s ease',
                border: '1px solid rgba(201,169,110,0.4)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <img src={portada} alt="Portada: Cuando Dios se siente lejos" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>

            {/* Presave form */}
            <div style={{ flex: '1 1 240px', minWidth: '220px', textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 700, lineHeight: 1.2, marginBottom: '8px' }}>
              Esto no es para todos. Es para quien lo necesita de verdad.
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.5)', fontSize: 'clamp(13px, 1.6vw, 15px)', lineHeight: 1.6, margin: '16px 0 24px' }}>
              Déjanos tu email. Te avisaremos el día que salga.
            </p>

            {status === 'sent' ? (
              <p style={{ fontFamily: 'var(--font-serif)', color: '#c9a96e', fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 700 }}>
                ¡Listo! Te avisaremos en cuanto esté disponible.
              </p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f5f0e8',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    padding: '14px 16px',
                    outline: 'none',
                  }}
                />
                <input
                  type="email"
                  required
                  placeholder="Tu correo"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#f5f0e8',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    padding: '14px 16px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  style={{
                    display: 'block',
                    background: '#c9a96e',
                    color: '#000',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    padding: '17px 24px',
                    border: 'none',
                    cursor: status === 'sending' ? 'default' : 'pointer',
                    opacity: status === 'sending' ? 0.6 : 1,
                    marginTop: '4px',
                  }}
                >
                  {status === 'sending' ? 'Enviando…' : 'Avísame cuando salga'}
                </button>
                {status === 'error' && (
                  <p style={{ fontFamily: 'var(--font-sans)', color: '#e08080', fontSize: '12px' }}>
                    No se pudo enviar, inténtalo de nuevo.
                  </p>
                )}
              </form>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Author section ─────────────────────────────────────────────────────────
function AuthorSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ background: '#000', padding: 'clamp(60px, 10vh, 120px) 24px', textAlign: 'center' }}>
      <div style={{ height: '1px', background: 'rgba(201,169,110,0.12)', maxWidth: '400px', margin: '0 auto 64px' }} />
      <div
        style={{
          opacity: vis ? 1 : 0,
          transform: vis ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 1s ease, transform 1s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid rgba(201,169,110,0.35)',
            flexShrink: 0,
            background: 'rgba(201,169,110,0.08)',
          }}
        >
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format"
            alt="Joel Blanco Sierra"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-serif)', color: '#f5f0e8', fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 700, marginBottom: '4px' }}>
            Joel Blanco Sierra
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', color: '#c9a96e', fontSize: '12px', fontWeight: 300, letterSpacing: '0.12em', marginBottom: '16px' }}>
            @joelblancosierra
          </div>
          <p style={{ fontFamily: 'var(--font-body)', color: 'rgba(245,240,232,0.5)', fontSize: 'clamp(14px, 1.6vw, 16px)', lineHeight: 1.8, fontStyle: 'italic', maxWidth: '400px', margin: '0 auto' }}>
            Joel Blanco Sierra es un joven emprendedor cristiano de España con una misión clara: llevar el amor de Dios a quien más lo necesita.
          </p>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', fontFamily: 'var(--font-serif)', color: 'rgba(201,169,110,0.4)', fontSize: 'clamp(13px, 1.8vw, 16px)', fontStyle: 'italic' }}>
          "Cercano está el Señor a los quebrantados de corazón."
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.18)', fontSize: '10px', letterSpacing: '0.18em' }}>
          Salmos 34:18
        </div>
        <div style={{ marginTop: '32px', fontFamily: 'var(--font-sans)', color: 'rgba(245,240,232,0.13)', fontSize: '11px', fontWeight: 300 }}>
          © {new Date().getFullYear()} Joel Blanco Sierra · Todos los derechos reservados
        </div>
        <a
          href="https://instagram.com/joelblancosierra"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', color: 'rgba(201,169,110,0.4)', fontSize: '11px', fontWeight: 300, textDecoration: 'none' }}
        >
          @joelblancosierra
        </a>
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>

      <Header />

      {/* ─── 1–5: HERO — the one persistent sticky book rides through all of
          it: turns to the back cover (section 2's quotes pass behind it),
          turns to the front and opens (section 3), closes back up and settles
          diagonal with the fact-card pop-ups (section 4), then shrinks and
          fades away into the phone (section 5, ordinary content sitting
          behind it) which flips through pages as you keep scrolling ─── */}
      <HeroSection />

      {/* ─── 6: OFFER ─── */}
      <OfferSection />

      {/* ─── AUTHOR ─── */}
      <AuthorSection />
    </div>
  )
}
