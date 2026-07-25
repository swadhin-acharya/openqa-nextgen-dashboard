import { Outlet } from 'react-router-dom'
import { OrgProvider } from '../lib/OrgContext'

/**
 * Wraps every org-scoped route (the org's project list, "new project",
 * and further-nested project routes) with :orgSlug resolution. Unlike
 * ProjectShell, this does NOT render AppShell/Sidebar - the org home page
 * and "new project" flow are account-chrome pages, not inside a specific
 * project's dashboard.
 */
export default function OrgShell() {
  return (
    <OrgProvider>
      <Outlet />
    </OrgProvider>
  )
}
