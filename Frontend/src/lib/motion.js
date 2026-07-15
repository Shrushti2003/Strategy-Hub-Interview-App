/**
 * Framer Motion animation presets for Strategy Hub.
 * Import these in any component that needs motion.
 */

// ── Page Transitions ─────────────────────────────────────────

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
}

// ── Fade Variants ────────────────────────────────────────────

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
}

export const fadeDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
}

// ── Scale Variants ───────────────────────────────────────────

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring", stiffness: 80, damping: 12 },
}

export const scaleUp = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring", stiffness: 100, damping: 15 },
}

// ── Container / Stagger ──────────────────────────────────────

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
}

// ── Slide Variants ───────────────────────────────────────────

export const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

export const slideInRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
}

// ── Modal / Overlay ──────────────────────────────────────────

export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

export const modalVariants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { type: "spring", stiffness: 300, damping: 25 },
}

// ── Hover Helpers (use with whileHover) ──────────────────────

export const hoverLift = {
  y: -2,
  transition: { duration: 0.2 },
}

export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2 },
}

export const tapScale = {
  scale: 0.98,
}

// ── Duration / Easing Constants ──────────────────────────────

export const DURATIONS = {
  micro: 0.15,
  standard: 0.25,
  emphasis: 0.4,
  dramatic: 0.6,
}

export const EASINGS = {
  standard: [0.4, 0, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
  spring: { type: "spring", stiffness: 80, damping: 12 },
}
