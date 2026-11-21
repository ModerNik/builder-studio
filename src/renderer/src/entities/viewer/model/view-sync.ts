/** Camera sync between viewers: whoever the user last touched drives, in schematic coordinates, so files
 *  pasted at the same position line up cell for cell. */
export interface ViewSync {
  driver: object | null
  followers: Set<(s: CamState) => void>
}
export interface CamState {
  ortho: boolean
  pos: number[]
  target: number[]
  zoom: number
}
export const createViewSync = (): ViewSync => ({ driver: null, followers: new Set() })
/** Make `owner` the viewer the others follow. */
export const drive = (sync: ViewSync, owner: object): void => void (sync.driver = owner)
