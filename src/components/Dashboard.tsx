import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import type { ListKey, MediaItem } from '../types'
import { LIST_KEYS } from '../types'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import ListColumn from './ListColumn'

interface DashboardProps {
  onOpenDetail: (item: MediaItem) => void
  onRate: (item: MediaItem) => void
}

const COLUMN_META: Record<ListKey, { title: string; subtitle: string }> = {
  wantToWatch: { title: '✦ Want to Watch', subtitle: 'The bucket list' },
  currentlyWatching: { title: '▶ Currently Watching', subtitle: 'On screen right now' },
  watched: { title: '✓ Watched', subtitle: 'Done - rate these!' },
}

interface DragId {
  listKey: ListKey
  mediaKey: string
  mediaId: number
}

function parseDragId(id: string | number): DragId | null {
  const str = String(id)
  const colonIdx = str.indexOf(':')
  if (colonIdx < 0) return null
  const listKey = str.slice(0, colonIdx) as ListKey
  if (!LIST_KEYS.includes(listKey)) return null
  const mediaKey = str.slice(colonIdx + 1)
  const mediaIdMatch = mediaKey.match(/-(\d+)$/)
  if (!mediaIdMatch) return null
  return { listKey, mediaKey, mediaId: Number(mediaIdMatch[1]) }
}

export default function Dashboard({ onOpenDetail, onRate }: DashboardProps) {
  const { lists, ratings, moveToList, reorderWithin, removeFromList } = useData()
  const { loggedIn } = useAuth()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const from = parseDragId(active.id)
    if (!from) return

    const overStr = String(over.id)

    // Dropped directly on a column container
    const targetList = LIST_KEYS.find((k) => overStr === k)
    if (targetList) {
      moveToList(from.mediaId, from.listKey, targetList)
      return
    }

    // Dropped on another item
    const overItem = parseDragId(overStr)
    if (!overItem) return

    if (overItem.listKey === from.listKey) {
      reorderWithin(from.listKey, from.mediaId, overItem.mediaId)
      return
    }

    moveToList(from.mediaId, from.listKey, overItem.listKey, overItem.mediaId)
  }

  return (
    <div className="dashboard">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {LIST_KEYS.map((key) => {
          const ids = lists[key].map((m) => `${key}:${m.mediaType}-${m.id}`)
          return (
            <SortableContext key={key} items={ids}>
              <ListColumn
                listKey={key}
                listId={key}
                title={COLUMN_META[key].title}
                subtitle={COLUMN_META[key].subtitle}
                items={lists[key]}
                ratings={ratings}
                draggable={loggedIn}
                onOpenDetail={onOpenDetail}
                onRemove={(id) => removeFromList(key, id)}
                onRate={key === 'watched' ? onRate : undefined}
              />
            </SortableContext>
          )
        })}
      </DndContext>
    </div>
  )
}