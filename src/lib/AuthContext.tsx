import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  /** profiles.is_admin for the current session - null while still resolving. */
  isAdmin: boolean | null
  /** profiles.name - null while still resolving. */
  name: string | null
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, isAdmin: null, name: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsAdmin(null)
      setName(null)
      return
    }
    supabase
      .from('profiles')
      .select('is_admin, name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin ?? false)
        setName(data?.name ?? null)
      })
  }, [session])

  return <AuthContext.Provider value={{ session, loading, isAdmin, name }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
