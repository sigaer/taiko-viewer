// One-way, session-local adaptation avoids repeatedly reallocating the drawing
// buffer. Brief stalls and inactive intervals do not lower image quality.
export const createCoverQuality = (initialRatio: number) => {
  let ratio = Math.max(.5, Math.min(1.5, initialRatio));
  let samples = 0, slow = 0;
  const reset = () => { samples = 0; slow = 0; };
  return {
    get ratio() { return ratio; },
    reset,
    sample(delta: number) {
      if (delta > 250) { reset(); return ratio; }
      if (delta < 8) return ratio;
      samples++; if (delta > 25) slow++;
      if (samples === 30) {
        if (slow >= 6) ratio = Math.max(.5, ratio * .75);
        reset();
      }
      return ratio;
    }
  };
};
