import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import AppRefreshListener from '@/components/AppRefreshListener'
import { Capacitor } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'
// DISABLED: JS alerts - native BackgroundService should be the only source of alerts
// import AlertAudioMonitor from '@/components/AlertAudioMonitor'
// import BackgroundFetchListener from '@/components/BackgroundFetchListener'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const MyUiReadyPlugin = registerPlugin('MyUiReadyPlugin');

function App() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'web') {
      MyUiReadyPlugin?.uiReady?.().catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClientInstance}>
      <AppRefreshListener />
      <Router>
        {/* <AlertAudioMonitor /> */}
        <NavigationTracker />
        <Routes>
          <Route path="/" element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          } />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  )
}

export default App
