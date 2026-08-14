import { produce } from 'immer'
import { Ledfx } from '../../api/ledfx'
import useStore from '../useStore'
import type { IStore } from '../useStore'

/**
 * Overrides are tapped live on a pad grid, so a success snackbar per tap is
 * noise. Requests are sent silently and only failures are surfaced.
 */
const reportIfFailed = (resp: any, fallback: string): boolean => {
  if (resp && resp.status === 'success') return true
  const reason = resp?.payload?.reason || resp?.payload?.message || fallback
  useStore.getState().ui.showSnackbar('error', reason)
  return false
}

/**
 * Colour overrides are a transient recolour layer the backend applies on top of
 * whatever effect a virtual is running. Unlike `apply_global`, they do not touch
 * effect config and are not persisted, so clearing one restores the show exactly.
 *
 * Server state is the source of truth: `colorOverrides` is filled from
 * `GET /api/effects` and kept current by the `virtual_color_override` websocket
 * event, so several clients pointed at the same instance stay in sync.
 */
const storeColorOverrides = (set: any) => ({
  // virtual id -> active colour/gradient string
  colorOverrides: {} as Record<string, string>,

  /** Apply a websocket `virtual_color_override` event to local state. */
  setColorOverride: (virtualId: string, colorOverride: string | null) =>
    set(
      produce((s: IStore) => {
        if (colorOverride === null) {
          delete s.colorOverrides[virtualId]
        } else {
          s.colorOverrides[virtualId] = colorOverride
        }
      }),
      false,
      'overrides/set'
    ),

  /** Refresh every virtual's override state from the backend. */
  getColorOverrides: async () => {
    const resp = await Ledfx('/api/effects')
    if (!resp || !resp.effects) return null
    const overrides: Record<string, string> = {}
    Object.entries(resp.effects).forEach(([virtualId, effect]: [string, any]) => {
      if (effect?.color_override) overrides[virtualId] = effect.color_override
    })
    set(
      produce((s: IStore) => {
        s.colorOverrides = overrides
      }),
      false,
      'overrides/got'
    )
    return overrides
  },

  /**
   * Gel the running effects with a colour or gradient.
   *
   * @param colorOrGradient a solid colour (`#ff0000`) or a `linear-gradient(...)`
   * @param virtualIds virtuals to target; omit or pass an empty list to target all
   */
  applyColorOverride: async (colorOrGradient: string, virtualIds?: string[]) => {
    const isGradient = colorOrGradient.includes('gradient')
    const payload: any = { action: 'apply_override' }
    payload[isGradient ? 'gradient' : 'color'] = colorOrGradient
    if (virtualIds && virtualIds.length > 0) payload.virtuals = virtualIds

    const resp = await Ledfx('/api/effects', 'PUT', payload, false)
    if (!reportIfFailed(resp, 'Failed to apply color override')) return false
    // Optimistic for the targeted virtuals; the websocket event confirms
    // shortly after and is what keeps an "all virtuals" call accurate.
    if (virtualIds && virtualIds.length > 0) {
      set(
        produce((s: IStore) => {
          virtualIds.forEach((id) => {
            s.colorOverrides[id] = colorOrGradient
          })
        }),
        false,
        'overrides/applied'
      )
    }
    return true
  },

  /** Drop back to the running effect on the given virtuals (all when omitted). */
  clearColorOverride: async (virtualIds?: string[]) => {
    const payload: any = { action: 'clear_override' }
    if (virtualIds && virtualIds.length > 0) payload.virtuals = virtualIds

    const resp = await Ledfx('/api/effects', 'PUT', payload, false)
    if (!reportIfFailed(resp, 'Failed to clear color override')) return false
    set(
      produce((s: IStore) => {
        if (virtualIds && virtualIds.length > 0) {
          virtualIds.forEach((id) => {
            delete s.colorOverrides[id]
          })
        } else {
          s.colorOverrides = {}
        }
      }),
      false,
      'overrides/cleared'
    )
    return true
  }
})

export default storeColorOverrides
