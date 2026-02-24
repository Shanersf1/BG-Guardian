import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import App from '@/App.jsx'
import '@/index.css'

// Register listeners BEFORE React mounts
const onResume = () => {
  console.log('[main] onResume fired - refetching bgReadings')
  queryClientInstance.refetchQueries({ queryKey: ['bgReadings'] })
}

CapacitorApp.addListener('resume', onResume)
CapacitorApp.addListener('appStateChange', ({ isActive }) => {
  if (isActive) onResume()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClientInstance}>
    <App />
  </QueryClientProvider>
)
