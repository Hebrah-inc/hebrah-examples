export type RelayMode = 'healthy' | '503' | 'timeout' | 'slow' | '429' | 'random'

export interface RelayModeConfig {
  mode: RelayMode
  failRate: number
  slowMs: number
}

let currentMode: RelayModeConfig = {
  mode: (process.env.RELAY_DEFAULT_MODE as RelayMode) || 'healthy',
  failRate: Number(process.env.RELAY_FAIL_RATE || '0.5'),
  slowMs: Number(process.env.RELAY_SLOW_MS || '3000')
}

export function getRelayMode(): RelayModeConfig {
  return { ...currentMode }
}

export function setRelayMode(config: Partial<RelayModeConfig>): RelayModeConfig {
  currentMode = {
    ...currentMode,
    ...config,
    mode: (config.mode ?? currentMode.mode) as RelayMode
  }
  return getRelayMode()
}

export function evaluateRelayResponse(mode: RelayModeConfig): { ok: true } | { ok: false, status: number, message: string } {
  if (mode.mode === 'healthy') return { ok: true }
  if (mode.mode === '503') return { ok: false, status: 503, message: 'Service unavailable (simulated)' }
  if (mode.mode === '429') return { ok: false, status: 429, message: 'Rate limited (simulated)' }
  if (mode.mode === 'timeout') return { ok: false, status: 504, message: 'Gateway timeout (simulated hang)' }
  if (mode.mode === 'slow') return { ok: true }
  if (mode.mode === 'random') {
    if (Math.random() < mode.failRate) {
      return { ok: false, status: 503, message: 'Random failure (simulated)' }
    }
    return { ok: true }
  }
  return { ok: true }
}
