import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import HomePage from './pages/HomePage'
import ImmobilierPage from './pages/ImmobilierPage'
import BoursePage from './pages/BoursePage'
import InvestissementPage from './pages/InvestissementPage'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="simulateurs-theme">
      <BrowserRouter basename="/simulateurs">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/immobilier" element={<ImmobilierPage />} />
          <Route path="/bourse" element={<BoursePage />} />
          <Route path="/investissement" element={<InvestissementPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
