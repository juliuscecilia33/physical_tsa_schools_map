import { ReactNode } from 'react'
import AuthGuard from '@/components/AuthGuard'
import ViewManager from '@/components/ViewManager'

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ViewManager />
      {children}
    </AuthGuard>
  )
}
