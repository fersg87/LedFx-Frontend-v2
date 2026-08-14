import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, useEdges } from '@xyflow/react'
import ReactGPicker from 'react-gcolor-picker'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material'
import { ArrowDropDown, Edit, EditOff, Public, Hub } from '@mui/icons-material'
import useStore from '../../store/useStore'

/**
 * A grid of one-tap colour pads that gel the effects running on the virtuals it
 * is connected to, using the backend's non-destructive override
 * (`apply_override` / `clear_override`). The effects keep animating underneath
 * and tapping the lit pad again restores them exactly.
 *
 * Everything the node needs lives in `node.data`, so pads travel with the Flow
 * layout: saved layouts, export and import all carry them with no extra work.
 */

export type ColorPad = {
  color?: string
  gradient?: string
}

export type PadGridScope = 'scoped' | 'global'

// Declared as a type alias, not an interface: xyflow types node data as
// Record<string, unknown>, which interfaces are not assignable to.
export type PadGridNodeData = {
  name: string
  scope: PadGridScope
  rows: number
  cols: number
  pads: ColorPad[]
  padSizeKey: PadSizeKey
  isCollapsed: boolean
  isEditMode: boolean
  onNodeDataChange: (_id: string, _data: any) => void
}

const PAD_SIZES = { S: 36, M: 48, L: 64, XL: 84 } as const
export type PadSizeKey = keyof typeof PAD_SIZES

export const DEFAULT_PAD_ROWS = 4
export const DEFAULT_PAD_COLS = 4
const MAX_PAD_AXIS = 8

/** Normalise a gradient string so it always carries an explicit angle. */
function normalizeGradient(colorStr: string): string {
  if (!colorStr || !colorStr.includes('linear-gradient')) return colorStr
  if (!colorStr.match(/linear-gradient\s*\(\s*\d+deg/)) {
    return colorStr.replace(/linear-gradient\s*\(/, 'linear-gradient(90deg, ')
  }
  return colorStr
}

/** Replace 180deg (ReactGPicker's first-time default) with a left-to-right 90deg. */
function fixDefaultAngle(colorStr: string): string {
  return colorStr.replace(/linear-gradient\s*\(\s*180deg/, 'linear-gradient(90deg')
}

/** Evenly spaced hue for pad `i` of `n`, used to fill a fresh grid. */
export function defaultPadColor(padIndex: number, totalPads: number): string {
  if (totalPads === 0) return '#ff0000'
  const h = (padIndex / totalPads) * 360
  const c = 1
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return `#${rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/** Build an auto-palette grid of `count` pads. */
export function buildDefaultPads(count: number): ColorPad[] {
  return Array.from({ length: count }, (_, i) => ({ color: defaultPadColor(i, count) }))
}

/** Grow or shrink a pad list to `count`, keeping the pads already customised. */
function resizePads(pads: ColorPad[], count: number): ColorPad[] {
  if (pads.length === count) return pads
  if (pads.length > count) return pads.slice(0, count)
  return [
    ...pads,
    ...Array.from({ length: count - pads.length }, (_, i) => ({
      color: defaultPadColor(pads.length + i, count)
    }))
  ]
}

/** True when a pad reads as dark, so overlay text should be white. */
function isDark(pad: ColorPad): boolean {
  if (pad.gradient) return true
  const c = (pad.color ?? '#000').replace('#', '')
  if (c.length !== 6) return true
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

function padSx(pad: ColorPad, padSize: number, isActive: boolean, isEditMode: boolean) {
  const bg = pad.gradient ?? pad.color ?? '#444'
  return {
    width: padSize,
    height: padSize,
    ...(pad.gradient
      ? { backgroundImage: bg, backgroundColor: 'transparent' }
      : { backgroundColor: bg }),
    backgroundClip: 'padding-box',
    cursor: 'pointer',
    border: isActive
      ? '3px solid white'
      : isEditMode
        ? '3px dashed rgba(255,255,255,0.4)'
        : '3px solid transparent',
    outline: isActive ? '2px solid rgba(255,255,255,0.5)' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    transition: 'all 0.15s',
    '&:hover': { opacity: 0.85 }
  }
}

// ─── Pad editor ──────────────────────────────────────────────────────────────

interface PadEditorProps {
  open: boolean
  pad: ColorPad
  padIndex: number
  totalPads: number
  onClose: () => void
  onSave: (_pad: ColorPad) => void
}

function PadEditorDialog({ open, pad, padIndex, totalPads, onClose, onSave }: PadEditorProps) {
  const [currentColor, setCurrentColor] = useState<string>(
    normalizeGradient(pad.gradient ?? pad.color ?? '#ff0000')
  )
  const [confirmReset, setConfirmReset] = useState(false)
  // Whether the picker held a gradient before the most recent change
  const wasGradientRef = useRef(Boolean(pad.gradient))

  const colors = useStore((state) => state.colors)
  const getColors = useStore((state) => state.getColors)

  useEffect(() => {
    if (!open) return
    const c = normalizeGradient(pad.gradient ?? pad.color ?? '#ff0000')
    setCurrentColor(c)
    setConfirmReset(false)
    wasGradientRef.current = c.includes('gradient')
    if (!colors || Object.keys(colors).length === 0) getColors()
  }, [open, pad, colors, getColors])

  const defaultColors = useMemo(() => {
    const out: string[] = []
    if (colors?.gradients?.builtin)
      out.push(...(Object.values(colors.gradients.builtin) as string[]))
    if (colors?.gradients?.user) out.push(...(Object.values(colors.gradients.user) as string[]))
    if (colors?.colors?.builtin) out.push(...(Object.values(colors.colors.builtin) as string[]))
    if (colors?.colors?.user) out.push(...(Object.values(colors.colors.user) as string[]))
    return out
  }, [colors])

  const handleChange = (c: string) => {
    let normalized = normalizeGradient(c)
    const isNowGradient = normalized.includes('gradient')
    // Only correct the picker's 180deg default on the first solid -> gradient switch
    if (isNowGradient && !wasGradientRef.current) normalized = fixDefaultAngle(normalized)
    wasGradientRef.current = isNowGradient
    setCurrentColor(normalized)
  }

  const handleSave = () => {
    onSave(currentColor.includes('gradient') ? { gradient: currentColor } : { color: currentColor })
    onClose()
  }

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    setCurrentColor(defaultPadColor(padIndex, totalPads))
    wasGradientRef.current = false
    setConfirmReset(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Pad Color</DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        {/* ReactGPicker hardcodes white surfaces; pull them back to the app theme */}
        <Box
          sx={(theme) => ({
            '& .colorpicker, & .popup_tabs, & .popup_tabs-header, & .color-picker-panel': {
              backgroundColor: `${theme.palette.background.paper} !important`
            },
            '& .popup_tabs-header-label': { color: `${theme.palette.text.secondary} !important` },
            '& .popup_tabs-header-label-active': {
              color: `${theme.palette.text.primary} !important`,
              backgroundColor: `${theme.palette.background.paper} !important`
            },
            '& .gradient-result': { display: 'none' },
            '& .input_rgba': { display: 'none' }
          })}
        >
          <ReactGPicker
            colorBoardHeight={150}
            debounce
            debounceMS={200}
            format="hex"
            gradient
            solid
            showAlpha={false}
            popupWidth={288}
            value={currentColor}
            defaultColors={defaultColors}
            onChange={handleChange}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
        {confirmReset ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="warning.main">
              Reset to default?
            </Typography>
            <Button size="small" color="warning" onClick={handleResetClick}>
              Confirm
            </Button>
            <Button size="small" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </Stack>
        ) : (
          <Button size="small" color="inherit" onClick={handleResetClick}>
            Reset to Default
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Apply
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

// ─── Node ────────────────────────────────────────────────────────────────────

const PadGridNode = ({ id, data }: { id: string; data: PadGridNodeData }) => {
  const {
    name,
    scope = 'scoped',
    rows = DEFAULT_PAD_ROWS,
    cols = DEFAULT_PAD_COLS,
    padSizeKey = 'M',
    isCollapsed,
    isEditMode,
    onNodeDataChange
  } = data

  const edges = useEdges()
  const applyColorOverride = useStore((state) => state.applyColorOverride)
  const clearColorOverride = useStore((state) => state.clearColorOverride)
  const colorOverrides = useStore((state) => state.colorOverrides)

  const [editingPadIndex, setEditingPadIndex] = useState<number | null>(null)

  const connectedVirtualIds = useMemo(
    () => edges.filter((edge) => edge.source === id).map((edge) => edge.target),
    [edges, id]
  )
  // An empty target list means "every virtual" to the backend
  const targetIds = useMemo(
    () => (scope === 'global' ? [] : connectedVirtualIds),
    [scope, connectedVirtualIds]
  )
  const isEnabled = scope === 'global' || connectedVirtualIds.length > 0

  const pads = useMemo(() => resizePads(data.pads ?? [], rows * cols), [data.pads, rows, cols])
  const padSize = PAD_SIZES[padSizeKey]

  /**
   * Which pad is lit, derived from server state rather than a local click flag,
   * so the node stays honest when another client changes the override.
   */
  const activePadIndex = useMemo(() => {
    const watched = scope === 'global' ? Object.keys(colorOverrides) : connectedVirtualIds
    if (watched.length === 0) return null
    const applied = watched.map((vid) => colorOverrides[vid]?.toLowerCase())
    const first = applied[0]
    // Only light a pad when every target carries the same override
    if (!first || applied.some((value) => value !== first)) return null
    // The core lowercases solid colours it echoes back, so compare case-insensitively
    const index = pads.findIndex((pad) => (pad.gradient ?? pad.color)?.toLowerCase() === first)
    return index === -1 ? null : index
  }, [colorOverrides, connectedVirtualIds, scope, pads])

  const handlePadClick = useCallback(
    (index: number) => {
      if (isEditMode) {
        setEditingPadIndex(index)
        return
      }
      if (!isEnabled) return
      if (activePadIndex === index) {
        clearColorOverride(targetIds)
        return
      }
      const pad = pads[index]
      const value = pad.gradient ?? pad.color
      if (value) applyColorOverride(value, targetIds)
    },
    [isEditMode, isEnabled, activePadIndex, pads, targetIds, applyColorOverride, clearColorOverride]
  )

  const handlePadSave = useCallback(
    (pad: ColorPad) => {
      if (editingPadIndex === null) return
      const next = [...pads]
      next[editingPadIndex] = pad
      onNodeDataChange(id, { pads: next })
    },
    [editingPadIndex, pads, id, onNodeDataChange]
  )

  let hint = 'Connect to a virtual to enable'
  if (isEditMode) hint = 'Click a pad to change its color'
  else if (isEnabled) hint = 'Tap a pad to gel · tap again to restore'

  const setGrid = (nextRows: number, nextCols: number) => {
    const r = Math.min(Math.max(nextRows, 1), MAX_PAD_AXIS)
    const c = Math.min(Math.max(nextCols, 1), MAX_PAD_AXIS)
    onNodeDataChange(id, { rows: r, cols: c, pads: resizePads(pads, r * c) })
  }

  return (
    <div style={{ position: 'relative' }}>
      <Paper sx={{ width: 'fit-content', minWidth: 300 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          className="drag-handle"
          sx={{ p: 1, pl: 2, bgcolor: '#111', height: 50, cursor: 'move' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => onNodeDataChange(id, { isCollapsed: !isCollapsed })}
              sx={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.2s'
              }}
            >
              <ArrowDropDown />
            </IconButton>
            <Typography>{name}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip
              title={
                scope === 'global'
                  ? 'Sending to all virtuals - click to send only to connected virtuals'
                  : 'Sending to connected virtuals - click to send to all'
              }
            >
              <IconButton
                size="small"
                color={scope === 'global' ? 'primary' : 'default'}
                onClick={() =>
                  onNodeDataChange(id, { scope: scope === 'global' ? 'scoped' : 'global' })
                }
              >
                {scope === 'global' ? <Public fontSize="small" /> : <Hub fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={isEditMode ? 'Done editing pads' : 'Edit pad colors'}>
              <IconButton
                size="small"
                color={isEditMode ? 'primary' : 'default'}
                onClick={() => onNodeDataChange(id, { isEditMode: !isEditMode })}
              >
                {isEditMode ? <EditOff fontSize="small" /> : <Edit fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {!isCollapsed && (
          <Box sx={{ p: 2 }}>
            {isEditMode && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Grid:
                  </Typography>
                  <Button size="small" onClick={() => setGrid(rows - 1, cols)}>
                    -
                  </Button>
                  <Typography variant="caption">{rows}</Typography>
                  <Button size="small" onClick={() => setGrid(rows + 1, cols)}>
                    +
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    x
                  </Typography>
                  <Button size="small" onClick={() => setGrid(rows, cols - 1)}>
                    -
                  </Button>
                  <Typography variant="caption">{cols}</Typography>
                  <Button size="small" onClick={() => setGrid(rows, cols + 1)}>
                    +
                  </Button>
                </Stack>
                <ToggleButtonGroup
                  size="small"
                  value={padSizeKey}
                  exclusive
                  onChange={(_, v) => v && onNodeDataChange(id, { padSizeKey: v })}
                >
                  {(Object.keys(PAD_SIZES) as PadSizeKey[]).map((k) => (
                    <ToggleButton key={k} value={k} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
                      {k}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${padSize}px)`,
                gap: '8px',
                width: 'fit-content',
                opacity: isEnabled || isEditMode ? 1 : 0.4
              }}
            >
              {pads.map((pad, i) => {
                const isActive = activePadIndex === i && !isEditMode
                return (
                  <Paper
                    key={i}
                    data-testid={`pad-${i}`}
                    elevation={isActive ? 8 : 2}
                    onClick={() => handlePadClick(i)}
                    sx={padSx(pad, padSize, isActive, Boolean(isEditMode))}
                  >
                    {isActive && (
                      <Typography
                        variant="caption"
                        sx={{ color: isDark(pad) ? '#fff' : '#000', fontWeight: 'bold' }}
                      >
                        ON
                      </Typography>
                    )}
                  </Paper>
                )
              })}
            </Box>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <Typography variant="caption" color="text.secondary" data-testid="pad-grid-hint">
                {hint}
              </Typography>
              {activePadIndex !== null && !isEditMode && (
                <Button size="small" onClick={() => clearColorOverride(targetIds)}>
                  Clear
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Paper>

      {scope === 'scoped' && <Handle type="source" position={Position.Right} />}

      {editingPadIndex !== null && (
        <PadEditorDialog
          open
          pad={pads[editingPadIndex]}
          padIndex={editingPadIndex}
          totalPads={pads.length}
          onClose={() => setEditingPadIndex(null)}
          onSave={handlePadSave}
        />
      )}
    </div>
  )
}

export default PadGridNode
