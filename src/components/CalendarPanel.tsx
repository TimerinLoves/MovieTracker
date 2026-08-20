import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { MediaItem, PlansMap, WatchPlan } from '../types'
import { posterUrl } from '../utils/tmdb'
import Modal from './Modal'

interface CalendarPanelProps {
  plans: PlansMap
  onOpenDetail: (item: MediaItem) => void
  onClose: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS = 14

interface DayCell {
  date: string
  label: number
  weekday: number
  isToday: boolean
  plans: WatchPlan[]
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CalendarPanel({ plans, onOpenDetail, onClose }: CalendarPanelProps) {
  const cells = useMemo<DayCell[]>(() => {
    const today = new Date()
    const todayKey = toDateKey(today)
    const out: DayCell[] = []
    for (let i = 0; i < DAYS; i++) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      const key = toDateKey(day)
      const dayPlans = Object.values(plans)
        .filter((p) => p.date === key)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
      out.push({
        date: key,
        label: day.getDate(),
        weekday: day.getDay(),
        isToday: key === todayKey,
        plans: dayPlans,
      })
    }
    return out
  }, [plans])

  const plannedCount = cells.reduce((acc, c) => acc + c.plans.length, 0)

  return (
    <Modal title="Calendar" onClose={onClose} maxWidth="920px">
      <p className="calendar-subtitle">
        Showing the next {DAYS} days{plannedCount > 0 ? ` - ${plannedCount} planned` : ' - nothing planned yet'}.
      </p>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell) => (
          <div key={cell.date} className={`calendar-day${cell.isToday ? ' today' : ''}${cell.plans.length ? ' has-plans' : ''}`}>
            <div className="calendar-day-head">
              <span className="calendar-day-num">{cell.label}</span>
              {cell.isToday && <span className="calendar-today-tag">Today</span>}
            </div>

            {cell.plans.length > 0 && (
              <div className="calendar-deck">
                {cell.plans.map((plan, idx) => {
                  const top = idx === cell.plans.length - 1
                  return (
                    <button
                      key={`${plan.item.mediaType}-${plan.item.id}`}
                      type="button"
                      className={`calendar-deck-card${top ? ' is-top' : ''}`}
                      style={{ '--off': `${idx * 14}px` } as CSSProperties}
                      title={`${plan.item.title} - ${plan.startTime}`}
                      onClick={() => onOpenDetail(plan.item)}
                    >
                      <span className="calendar-deck-poster">
                        {posterUrl(plan.item.posterPath) ? (
                          <img src={posterUrl(plan.item.posterPath)!} alt={plan.item.title} loading="lazy" />
                        ) : (
                          <span className="calendar-stack-fallback">{plan.item.title.slice(0, 1).toUpperCase()}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
                <span className="calendar-deck-times">
                  {cell.plans.map((p) => p.startTime).join(' / ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}