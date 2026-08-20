import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Modal from './Modal'

interface LoginModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const { login, userCount } = useAuth()
  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await login(key, displayName)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSuccess?.()
    onClose()
  }

  return (
    <Modal title="Enter your access key" onClose={onClose} maxWidth="420px">
      <form onSubmit={submit} className="login-form">
        <p className="login-hint">
          This site supports {userCount} keys - one per person. The key unlocks editing (and rating).
          Without it, the site is read-only.
        </p>
        <label className="field-label" htmlFor="login-key">Access key</label>
        <input
          id="login-key"
          type="password"
          className="text-input"
          placeholder="Your secret key..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
        />
        <label className="field-label" htmlFor="login-name">Your display name</label>
        <input
          id="login-name"
          type="text"
          className="text-input"
          placeholder="e.g. Timer"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={20}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-accent btn-block" disabled={busy}>
          {busy ? 'Checking...' : 'Unlock'}
        </button>
        <p className="login-note">
          Not set up yet? Run <code>npm run set-passwords</code> and your keys will work.
        </p>
      </form>
    </Modal>
  )
}