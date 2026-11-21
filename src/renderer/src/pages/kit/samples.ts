// Made-up preview images for kit specimens, drawn as SVG data URLs so the kit needs no files.

const url = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** A sketch of a build: a banded tower on a stone base, against a sky. */
export function towerSketch(sky: string, bands: [string, string], w = 320, h = 200): string {
  const tw = w * 0.18
  const x = w / 2 - tw / 2
  const rows = Array.from({ length: 7 }, (_, i) => {
    const y = h * 0.18 + i * h * 0.09
    return `<rect x="${x}" y="${y}" width="${tw}" height="${h * 0.09}" fill="${bands[i % 2]}"/>`
  }).join('')
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${sky}"/>` +
      `<rect y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="#4a4f57"/>${rows}` +
      `<rect x="${x - 6}" y="${h * 0.1}" width="${tw + 12}" height="${h * 0.08}" fill="#5e8c7c"/></svg>`
  )
}

/** A pixel sprite: a w×h grid of block colours. */
export function sprite(colours: string[], seed: number, n = 12): string {
  let cells = ''
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = Math.abs(Math.sin(seed * 31 + x * 7 + y * 13))
      if (y > 2 && Math.abs(x - n / 2) < 3 + y / 3)
        cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colours[Math.floor(v * colours.length)]}"/>`
    }
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${cells}</svg>`
  )
}
