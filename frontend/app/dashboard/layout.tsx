"use client"

import { Sidebar } from "@/components/Sidebar"
import { useUserRole } from "@/context/UserRoleContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isVerified, isSuspended, approvalStatus, loading, role } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // 0. Handle Suspended Instance
      if (isSuspended) {
        router.push("/pending")
        return
      }

      // 1. Handle Pending/Rejected Status
      if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
        router.push("/pending")
        return
      }

      // 2. Handle Unverified Instance (License not setup)
      if (!isVerified) {
        if (role === 'admin') {
          router.push("/setup")
        } else {
          // If instance isn't verified, standard users go back to pending screen
          router.push("/pending")
        }
        return
      }
    }
  }, [loading, isVerified, approvalStatus, role, router])

  if (loading || isSuspended || !isVerified || approvalStatus === 'pending' || approvalStatus === 'rejected') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-black fixed inset-0 z-[100]">
        <div className="flex flex-col items-center gap-6 max-w-md text-center p-8 transition-all">
          {isSuspended ? (
            <>
              <div className="h-20 w-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center animate-pulse">
                 <div className="h-12 w-12 text-red-600">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                 </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instance Suspended</h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Your organization's access to Pluto has been suspended by the administrator. 
                  Please contact support or your account manager for assistance.
                </p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-gray-500 animate-pulse">
                {approvalStatus === 'pending' ? 'Verifying your account...' : 'Initializing workspace...'}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
