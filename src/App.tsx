import { useState } from 'react'
import type { MediaItem, MovieRating, UserRating } from './types'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider, useData } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import Ambient from './components/Ambient'
import Dashboard from './components/Dashboard'
import DetailModal from './components/DetailModal'
import LoginModal from './components/LoginModal'
import Navbar from './components/Navbar'
import RatingModal from './components/RatingModal'
import ScoreBreakdown from './components/ScoreBreakdown'
import SearchResults from './components/SearchResults'
import SettingsPanel from './components/SettingsPanel'

function Shell() {
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null)
  const [ratingItem, setRatingItem] = useState<MediaItem | null>(null)
  const [breakdownItem, setBreakdownItem] = useState<MediaItem | null>(null)
  const { pushToast } = useToast()
  const { session } = useAuth()
  const { ratings, rateItem } = useData()

  const searching = query.trim().length > 0
  const ratingKey = ratingItem ? `${ratingItem.mediaType}-${ratingItem.id}` : null
  const myRating: UserRating | undefined =
    ratingItem && session ? (ratings[ratingKey!]?.[`slot${session.slotId}` as 'slot0' | 'slot1'] as UserRating | undefined) : undefined

  const openLogin = () => setLoginOpen(true)

  return (
    <div className="app">
      <Ambient />

      <Navbar
        query={query}
        onQueryChange={setQuery}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="main">
        {searching ? (
          <SearchResults query={query} onOpenDetail={setDetailItem} />
        ) : (
          <Dashboard
            onOpenDetail={setDetailItem}
            onRate={(item) => setRatingItem(item)}
          />
        )}
      </main>

      <footer className="footer">
        <span>
          {session
            ? `Editing as ${session.displayName} - drag cards between lists, rate what you've watched.`
            : 'Read-only mode - enter your access key to edit & rate.'}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={openLogin}>
          {session ? 'Switch key' : 'Unlock'}
        </button>
      </footer>

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={() => pushToast('Access key accepted - editing unlocked.')}
        />
      )}

      {detailItem && (
        <DetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRate={(item) => {
            setDetailItem(null)
            setRatingItem(item)
          }}
          onShowBreakdown={(item) => setBreakdownItem(item)}
        />
      )}

      {ratingItem && session && (
        <RatingModal
          item={ratingItem}
          existing={myRating}
          displayName={session.displayName}
          onSubmit={(scores) => {
            rateItem(`${ratingItem.mediaType}-${ratingItem.id}`, scores)
            pushToast(`Saved your rating for "${ratingItem.title}".`)
          }}
          onClose={() => setRatingItem(null)}
        />
      )}

      {breakdownItem && ratings[`${breakdownItem.mediaType}-${breakdownItem.id}`] && (
        <ScoreBreakdown
          title={breakdownItem.title}
          mediaKey={`${breakdownItem.mediaType}-${breakdownItem.id}`}
          rating={ratings[`${breakdownItem.mediaType}-${breakdownItem.id}`] as MovieRating}
          labelA="User A"
          labelB="User B"
          onClose={() => setBreakdownItem(null)}
        />
      )}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}