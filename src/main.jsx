import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { queryClientInstance } from '@/lib/query-client'
import App from '@/App.jsx'
import '@/index.css'

// Register Capacitor lifecycle listeners BEFORE React mounts.
// When the app resumes from background/lock, events fire before components load.
// Must run at startup so listeners exist when Capacitor fires resume.
const onResume = () => {
  queryClientInstance.invalidateQueries({ queryKey: ['bgReadings'] })
}
CapacitorApp.addListener('resume', onResume)
CapacitorApp.addListener('appStateChange', ({ isActive }) => {
  if (isActive) onResume()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
