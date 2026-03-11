import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import HomePage from './pages/HomePage'
import ImmobilierPage from './pages/ImmobilierPage'
import BoursePage from './pages/BoursePage'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="simulateurs-theme">
      <BrowserRouter basename="/simulateurs">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/immobilier" element={<ImmobilierPage />} />
          <Route path="/bourse" element={<BoursePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
