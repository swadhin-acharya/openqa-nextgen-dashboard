import { Routes, Route } from 'react-router-dom'
import { RequireAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import NewProjectPage from './pages/NewProjectPage'
import ProjectShell from './pages/ProjectShell'
import ProjectOverviewPage from './pages/ProjectOverviewPage'
import TokensPage from './pages/TokensPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/new"
        element={
          <RequireAuth>
            <NewProjectPage />
          </RequireAuth>
        }
      />
      <Route
        path="/:slug"
        element={
          <RequireAuth>
            <ProjectShell />
          </RequireAuth>
        }
      >
        <Route index element={<ProjectOverviewPage />} />
        <Route path="tokens" element={<TokensPage />} />
      </Route>
    </Routes>
  )
}
