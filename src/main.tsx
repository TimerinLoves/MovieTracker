import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes/moonlit-macarons.css'
import './themes/snowflake-sorbet.css'
import './themes/peachy-dreams.css'
import './themes/starry-sweets.css'
import './themes/mint-macaron.css'
import './themes/bubblegum-galaxy.css'
import './themes/lavender-fields.css'
import './themes/cotton-candy-portal.css'
import './themes/cloud-cinema.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)