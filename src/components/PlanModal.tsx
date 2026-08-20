import { useEffect, useMemo, useState } from 'react'
import type { MediaItem, WatchPlan } from '../types'
import { fetchRuntimeMinutes, posterUrl } from '../utils/tmdb'
import Modal from './Modal'

interface PlanModalProps {
  item: MediaItem
  existing?: WatchPlan
  onSave: (plan: WatchPlan) => void
  onRemove?: () => void
  onClose: () => void
}

function todayValue(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function PlanModal({ item, existing, onSave, onRemove, onClose }: PlanModalProps) {
  const [date, setDate] = useState(existing?.date ?? todayValue())
  const [startTime, setStartTime] = useState(existing?.startTime ?? '20:00')
  const [runtime, setRuntime] = useState<number | null>(existing?.durationMinutes ?? null)
  const [loading, setLoading] = useState(!existing && runtime === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (existing?.durationMinutes != null) {
      setRuntime(existing.durationMinutes)
      return
    }
    let cancelled = false
    fetchRuntimeMinutes(item).then((mins) => {
      if (cancelled) return
      setRuntime(mins ?? null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [existing, item])

  const endTime = useMemo(() => {
    if (runtime === null || runtime === undefined || !startTime) return null
    const [h, m] = startTime.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    const total = h * 60 + m + runtime
    const eh = Math.floor(total / 60) % 24
    const em = total % 60
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  }, [runtime, startTime])

  const submit = () => {
    if (!date) {
      setError('Pick a day.')
      return
    }
    if (!startTime) {
      setError('Pick a start time.')
      return
    }
    onSave({ item, date, startTime, durationMinutes: runtime })
    onClose()
  }

  const poster = posterUrl(item.posterPath)

  return (
    <Modal title={`Plan "${item.title}"`} onClose={onClose} maxWidth="480px">
      <div className="detail-layout plan-layout">
        {poster && <img className="detail-poster plan-poster" src={poster} alt={item.title} />}
        <div className="detail-info">
          <div className="detail-tags">
            <span className="chip chip-type">{item.mediaType === 'movie' ? 'Movie' : 'TV show'}</span>
            {item.year && <span className="chip">{item.year}</span>}
          </div>

          <div className="plan-fields">
            <label className="field-label" htmlFor="plan-date">
              Day
            </label>
            <input
              id="plan-date"
              type="date"
              className="text-input"
              value={date}
              min={todayValue()}
              onChange={(e) => setDate(e.target.value)}
            />

            <label className="field-label" htmlFor="plan-time">
              Start time
            </label>
            <input
              id="plan-time"
              type="time"
              className="text-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <p className="plan-runtime">
            {loading ? 'Looking up runtime...' : runtime !== null ? `Roughly ${startTime} to ${endTime} we'd be occupied.` : 'Runtime unknown - time from start only.'}
          </p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="rating-footer">
        <div className="rating-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {onRemove && (
            <button type="button" className="btn btn-ghost btn-danger" onClick={onRemove}>
              Remove plan
            </button>
          )}
          <button type="button" className="btn btn-accent" onClick={submit}>
            {existing ? 'Update plan' : 'Save plan'}
          </button>
        </div>
      </div>
    </Modal>
  )
}