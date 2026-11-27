export type PickerOption = { value: string; label: string }

/** Maps an effort value to its 0-based slider stop index (defaults to 0 if not found). */
export function effortIndexOf(
  efforts: readonly PickerOption[],
  effort: string | undefined
): number {
  if (!efforts.length || !effort) return 0
  const idx = efforts.findIndex((e) => e.value === effort)
  return idx < 0 ? 0 : idx
}

/** Compact stop label beneath the slider so 4-5 stops stay crisp without wrapping. */
export function shortEffortStopLabel(value: string, label: string, count: number): string {
  if (count >= 4) {
    if (value === 'medium') return 'Med'
    if (value === 'xhigh') return 'XHigh'
  }
  return label
}
