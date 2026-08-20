import { useAuth } from '../contexts/AuthContext'
import ThemeSwitcher from './ThemeSwitcher'

interface NavbarProps {
  query: string
  onQueryChange: (value: string) => void
  onOpenSettings: () => void
}

export default function Navbar({ query, onQueryChange, onOpenSettings }: NavbarProps) {
  const { session, loggedIn } = useAuth()

  return (
    <header className="navbar">
      <div className="brand">
        <span className="brand-icon">♥</span>
        <span className="brand-name">SweetScreen</span>
      </div>

      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          placeholder="Search movies & shows..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search movies and shows"
        />
      </div>

      <div className="nav-actions">
        <ThemeSwitcher />
        <button type="button" className="btn btn-ghost nav-settings" onClick={onOpenSettings} title="Settings">
          ⚙
        </button>
        <button type="button" className={`btn btn-accent nav-unlock${loggedIn ? '' : ''}`} onClick={onOpenSettings}>
          {loggedIn ? session?.displayName ?? 'Unlocked' : 'Locked ✱'}
        </button>
      </div>
    </header>
  )
}