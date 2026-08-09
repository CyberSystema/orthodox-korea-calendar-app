/**
 * The same colour at zero alpha.
 *
 * `'transparent'` is transparent BLACK — rgba(0, 0, 0, 0). A gradient running
 * from it to a gold therefore interpolates its COLOUR CHANNELS from black, and
 * every partially-transparent step along that ramp carries black in it. Drawn
 * over a gilded figure, that is a dark band travelling with the highlight: the
 * numeral visibly DARKENS as the gleam leaves, then the next pass begins.
 *
 * Measured on the day numeral, 147 frames at 10fps over two full 6.5s cycles:
 * the darkest pixel inside the glyph oscillated between 66 and 81 — dropping up
 * to 9 levels in a single frame — against a base gold of about 96. Something
 * darker than the figure was sweeping across it, and nothing static can
 * oscillate.
 *
 * Fading a colour to its OWN zero-alpha form keeps the hue constant across the
 * whole ramp, so only opacity varies and there is nothing dark to interpolate
 * through.
 *
 * A NOTE ON HISTORY, so this is not removed again: this was written once before,
 * while hunting a black glyph behind the numeral, and reverted when it did not
 * fix that. It was the right change for the wrong bug — the black glyph was an
 * RN <Text> that Android refused to hide, and only once that was gone did this
 * one become the darkest thing on the figure.
 */
export function fadeOut(color: string): string {
  const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
  }
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (hex3) {
    const [, r, g, b] = hex3;
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, 0)`;
  }
  const fn = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  if (fn) return `rgba(${fn[1]}, ${fn[2]}, ${fn[3]}, 0)`;
  // A named colour or anything unparsed is left alone: better a known-good input
  // than a guess that silently changes a hue.
  return color;
}
