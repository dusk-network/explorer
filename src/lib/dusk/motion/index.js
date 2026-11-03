import { cubicIn, quartOut } from "svelte/easing";
import { prefersReducedMotion } from "svelte/motion";
import { fade, fly } from "svelte/transition";

/** @typedef {import("svelte/transition").TransitionConfig} TransitionConfig */

/**
 * Motion, as in every Dusk app and as the `--motion-*` tokens in
 * duskit-bridge.css: `fast` (ms) for feedback and every exit, `base` for
 * anything that arrives or opens, `ease` to arrive and `exit` to leave, and
 * never farther than `shift` (px).
 */
export const MOTION = Object.freeze({
  base: 200,
  ease: quartOut,
  exit: cubicIn,
  fast: 120,
  shift: 4,
});

/** How long a copy button says Copied, in ms. */
export const COPIED_FOR = 1500;

/**
 * Whether less motion was asked for, the one place that reads it: then
 * nothing travels or changes size, and opacity still changes.
 */
export const isReducedMotion = () => prefersReducedMotion.current;

/**
 * A message arriving, as a toast: it fades in from shift below, over base.
 *
 * @param {Element} node
 * @returns {TransitionConfig}
 */
export const messageIn = (node) =>
  fly(node, {
    duration: MOTION.base,
    easing: MOTION.ease,
    y: isReducedMotion() ? 0 : MOTION.shift,
  });

/**
 * A message leaving: it fades out in place, over fast.
 *
 * @param {Element} node
 * @returns {TransitionConfig}
 */
export const messageOut = (node) =>
  fade(node, { duration: MOTION.fast, easing: MOTION.exit });

/**
 * How the messages left close up, as `animate:flip={closeUp()}`: over base,
 * or at once with less motion.
 */
export const closeUp = () => ({
  duration: isReducedMotion() ? 0 : MOTION.base,
  easing: MOTION.ease,
});
