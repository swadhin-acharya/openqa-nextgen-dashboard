import { Routes, Route } from 'react-router-dom'
import { RequireAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import NewOrgPage from './pages/NewOrgPage'
import NewProjectPage from './pages/NewProjectPage'
import OrgShell from './pages/OrgShell'
import OrgHomePage from './pages/OrgHomePage'
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
        path="/orgs/new"
        element={
          <RequireAuth>
            <NewOrgPage />
          </RequireAuth>
        }
      />
      <Route
        path="/:orgSlug"
        element={
          <RequireAuth>
            <OrgShell />
          </RequireAuth>
        }
      >
        <Route index element={<OrgHomePage />} />
        <Route path="projects/new" element={<NewProjectPage />} />
        <Route path=":projectSlug" element={<ProjectShell />}>
          <Route index element={<ProjectOverviewPage />} />
          <Route path="tokens" element={<TokensPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
