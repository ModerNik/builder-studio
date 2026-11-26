/** Fetches an image URL as raw bytes for clipboard copy or export. */
export async function fetchImageBytes(src: string): Promise<Uint8Array> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Could not read image (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}
