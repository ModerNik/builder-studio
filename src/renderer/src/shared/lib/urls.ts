// URLs of the custom protocols the main process serves (src/main/app/protocols.ts).
/** build://repo/<repo-relative path>; `v` busts the image cache when a file is rewritten in place. */
export const buildUrl = (rel: string, v?: number): string => {
  const absolute = /^(?:[A-Za-z]:[\\/]|\/)/.test(rel)
  const path = absolute ? encodeURIComponent(rel) : rel.split('/').map(encodeURIComponent).join('/')
  return `build://${absolute ? 'local' : 'repo'}/${path}${v ? `?v=${v}` : ''}`
}
export const resourceUrl = (rel: string): string =>
  `build://resource/${rel.split('/').map(encodeURIComponent).join('/')}`
export const assetUrl = (rel: string): string =>
  `build://assets/${rel.split('/').map(encodeURIComponent).join('/')}`
