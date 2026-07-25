import { ProjectProvider } from '../lib/ProjectContext'
import { AppShell } from '../components/layout/AppShell'

/**
 * Wraps every project-scoped route (Overview, Tokens, ...) with slug
 * resolution (ProjectProvider) and the Sidebar/AppShell chrome. Account-level
 * pages (login, signup, home, new-project) render outside this shell.
 */
export default function ProjectShell() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  )
}
