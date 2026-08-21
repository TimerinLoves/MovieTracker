import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { firebaseEnabled } from '../firebase/config'
import Modal from './Modal'
import LoginModal from './LoginModal'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { session, logout, saveGitHubToken, unlockGitHubToken, tokenUnlocked, sharedTokenReady } = useAuth()
  const { themes, themeId, setTheme } = useTheme()
  const { syncState, syncReason, repoConfigured, refresh } = useData()
  const { pushToast } = useToast()

  const [showLogin, setShowLogin] = useState(false)
  const [ghToken, setGhToken] = useState('')
  const [unlockKey, setUnlockKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const syncLabel = useMemo(() => {
    if (firebaseEnabled) {
      if (syncState === 'syncing') return 'Saving...'
      return 'Live sync (Firebase)'
    }
    if (syncState === 'syncing') return 'Syncing to GitHub...'
    if (syncState === 'offline') return repoConfigured ? 'GitHub token locked' : 'GitHub repo not configured'
    if (sharedTokenReady && tokenUnlocked) return 'Synced to GitHub (shared key)'
    return 'Synced to GitHub'
  }, [syncState, repoConfigured, sharedTokenReady, tokenUnlocked])

  const onSaveToken = async () => {
    if (!ghToken.trim()) return
    setSaving(true)
    setNotice(null)
    const ok = await saveGitHubToken(ghToken.trim())
    setSaving(false)
    if (ok) {
      setGhToken('')
      pushToast('GitHub token saved (encrypted).')
      setNotice('Token saved - edits now sync to the repo.')
    } else {
      setNotice('Could not save the token. Try logging in again first.')
    }
  }

  const onUnlock = async () => {
    setSaving(true)
    setNotice(null)
    const ok = await unlockGitHubToken(unlockKey)
    setSaving(false)
    if (ok) {
      setUnlockKey('')
      setNotice('GitHub token unlocked - you can sync to the repo now.')
    } else {
      setNotice('Wrong key, or no stored token found.')
    }
  }

  const onLogout = () => {
    logout()
    pushToast('Logged out - editing is now locked.')
  }

  return (
    <Modal title="Settings" onClose={onClose} maxWidth="560px">
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false)
            pushToast('Access key accepted - you can now edit.')
          }}
        />
      )}

      <section className="settings-section">
        <h3>Account</h3>
        {session ? (
          <div className="setting-row">
            <div>
              <div className="setting-value">{session.displayName}</div>
              <div className="setting-hint">Editing unlocked. Log out to go read-only.</div>
            </div>
            <button type="button" className="btn btn-ghost btn-danger" onClick={onLogout}>
              Log out
            </button>
          </div>
        ) : (
          <div className="setting-row">
            <div>
              <div className="setting-value">Read-only mode</div>
              <div className="setting-hint">Browse freely - editing & rating need your access key.</div>
            </div>
            <button type="button" className="btn btn-accent" onClick={() => setShowLogin(true)}>
              Enter key
            </button>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h3>Theme</h3>
        <div className="theme-grid">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card${t.id === themeId ? ' active' : ''}`}
              title={t.name}
              onClick={() => {
                setTheme(t.id)
                pushToast(`Theme: ${t.name}`)
              }}
            >
              <span className="theme-card-preview" style={{ background: t.preview }} />
              <span className="theme-card-name">{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Sync</h3>
        <div className="setting-row">
          <div>
            <div className="setting-value">{syncLabel}</div>
            <div className="setting-hint">
              {firebaseEnabled
                ? 'Changes save to Firebase and appear on every device instantly.'
                : 'Data is written to the repo on every edit.'}
            </div>
            {syncReason && <div className="setting-hint setting-warn">{syncReason}</div>}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </section>

      {!firebaseEnabled && (
        <section className="settings-section">
          <h3>GitHub sync</h3>
          <div className="setting-row">
            <div>
              <div className="setting-value">
                {repoConfigured ? 'Repo configured' : 'No repo configured'}
              </div>
              <div className="setting-hint">
                {repoConfigured
                  ? 'Data is written to <repo>/data/ on every edit.'
                  : 'No repo configured yet - data stays in this browser. Add the REPO_NAME build secret to enable syncing.'}
              </div>
            </div>
          </div>

          {repoConfigured && (
            <>
              {!tokenUnlocked ? (
                <div className="setting-block">
                  <label className="field-label" htmlFor="settings-key">
                    Re-enter your access key to unlock the stored token
                  </label>
                  <div className="setting-inline">
                    <input
                      id="settings-key"
                      type="password"
                      className="text-input"
                      placeholder="Your access key"
                      value={unlockKey}
                      onChange={(e) => setUnlockKey(e.target.value)}
                    />
                    <button type="button" className="btn btn-accent" onClick={() => void onUnlock()} disabled={saving}>
                      Unlock
                    </button>
                  </div>
                </div>
              ) : (
                <div className="setting-value">Token unlocked ✓</div>
              )}

              <div className="setting-block">
                <label className="field-label" htmlFor="settings-token">
                  {tokenUnlocked ? 'Replace GitHub token' : 'Save GitHub token (encrypted with your key)'}
                </label>
                <div className="setting-inline">
                  <input
                    id="settings-token"
                    type="password"
                    className="text-input"
                    placeholder="github_pat_..."
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                  />
                  <button type="button" className="btn btn-accent" onClick={() => void onSaveToken()} disabled={saving}>
                    Save
                  </button>
                </div>
                <div className="setting-hint">
                  The token is encrypted with your access key and stored only on this device.
                </div>
              </div>
              {notice && <div className="setting-hint setting-warn">{notice}</div>}
            </>
          )}
        </section>
      )}
    </Modal>
  )
}
