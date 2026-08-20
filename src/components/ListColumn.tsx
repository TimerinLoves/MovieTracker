import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ListKey, MediaItem, MovieRating, RatingsMap } from '../types'
import MediaCard from './MediaCard'

const mediaKeyOf = (item: MediaItem) => `${item.mediaType}-${item.id}`

interface ListColumnProps {
  listKey: ListKey
  title: string
  subtitle: string
  items: MediaItem[]
  listId: string
  draggable: boolean
  ratings: RatingsMap
  onOpenDetail: (item: MediaItem) => void
  onRemove: (id: number) => void
  onRate?: (item: MediaItem) => void
}

export default function ListColumn({
  listKey,
  title,
  subtitle,
  items,
  listId,
  draggable,
  ratings,
  onOpenDetail,
  onRemove,
  onRate,
}: ListColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: listId })

  return (
    <section className={`list-column${isOver ? ' over' : ''} ${items.length === 0 ? ' is-empty' : ''}`}>
      <header className="list-header">
        <h3>
          {title} <span className="list-count">{items.length}</span>
        </h3>
        <p className="list-subtitle">{subtitle}</p>
      </header>

      <div ref={setNodeRef} className="list-zones">
        {items.map((item) => {
          const key = mediaKeyOf(item)
          const showRate = onRate && draggable
          return (
            <SortableShell
              key={key}
              id={`${listKey}:${key}`}
              item={item}
              rating={ratings[key]}
              draggable={draggable}
              onOpenDetail={onOpenDetail}
              onRemove={onRemove}
              onRate={showRate ? onRate : undefined}
            />
          )
        })}
        {items.length === 0 && <div className="list-empty-hint">Drop something here ✧</div>}
      </div>
    </section>
  )
}

function SortableShell({
  id,
  item,
  rating,
  draggable,
  onOpenDetail,
  onRemove,
  onRate,
}: {
  id: string
  item: MediaItem
  rating?: MovieRating
  draggable: boolean
  onOpenDetail: (item: MediaItem) => void
  onRemove: (id: number) => void
  onRate?: (item: MediaItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`sortable-shell${isDragging ? ' dragging' : ''}${draggable ? ' can-drag' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      <MediaCard
        item={item}
        rating={rating}
        removable={draggable}
        compact
        onRemove={() => onRemove(item.id)}
        onClick={() => onOpenDetail(item)}
      />
      {onRate && (
        <button type="button" className="btn btn-ghost btn-rate" onClick={() => onRate(item)}>
          ★ Rate
        </button>
      )}
    </div>
  )
}