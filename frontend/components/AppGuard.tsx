"use client"

import { useUserRole } from "@/context/UserRoleContext"
import { usePathname } from "next/navigation"
import { ShieldAlert, LogOut, Loader2 } from "lucide-react"
import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export function AppGuard({ children }: { children: React.ReactNode }) {
  const { isSuspended, approvalStatus, loading } = useUserRole()
  const pathname = usePathname()

  // Allowed paths even when suspended
  const allowedPaths = ["/pending", "/sign-in", "/sign-up"]

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Combined suspension check: either instance-wide or individual user suspension
  const isUserSuspended = approvalStatus === 'suspended'

  if ((isSuspended || isUserSuspended) && !allowedPaths.includes(pathname)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-black fixed inset-0 z-[100]">
        <div className="flex flex-col items-center gap-6 max-w-md text-center p-8 transition-all">
          <div className="h-20 w-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center animate-pulse text-red-600">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isUserSuspended ? "Account Suspended" : "Instance Suspended"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {isUserSuspended 
                ? "Your individual account has been suspended by your administrator. Please contact your organization's admin for details."
                : "Your organization's access to Pluto has been suspended by the administrator. Please contact support or your account manager for assistance."
              }
            </p>
          </div>
          <div className="flex gap-4">
            <SignOutButton>
              <Button variant="outline" className="flex items-center gap-2">
                <LogOut size={16} />
                Sign Out
              </Button>
            </SignOutButton>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
