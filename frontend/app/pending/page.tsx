"use client"

import { useUser, SignOutButton } from "@clerk/nextjs"
import { useUserRole } from "@/context/UserRoleContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Clock, Loader2, LogOut, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const PendingApprovalPage = () => {
  const { user, isLoaded } = useUser()
  const { approvalStatus, isVerified, isInstanceActivated, isSuspended, loading, refreshRole } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in")
    }
    // Only redirect to dashboard if user is approved AND someone (admin) has activated the instance AND not suspended
    if (!loading && approvalStatus === "approved" && isVerified && isInstanceActivated && !isSuspended) {
      router.push("/dashboard")
    }
  }, [isLoaded, user, approvalStatus, isVerified, isInstanceActivated, isSuspended, loading, router])

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const isActivatedUserWaiting = approvalStatus === "approved" && !isVerified
  const isPendingUserOnActivatedInstance = approvalStatus === "pending" && isInstanceActivated
  const isPendingInstance = !isInstanceActivated

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {isSuspended ? (
          <div className="mb-6 inline-flex p-4 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
            <ShieldAlert className="h-12 w-12" />
          </div>
        ) : (
          <div className="mb-6 inline-flex p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
            <Clock className="h-12 w-12" />
          </div>
        )}
        
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          {isSuspended ? "Account Suspended" :
           isActivatedUserWaiting ? "Activation Required" : 
           isInstanceActivated ? "Waiting for Approval" :
           "System Setup Required"}
        </h1>
        
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm leading-relaxed">
          {isSuspended 
            ? `Hello ${user?.firstName}! Your organization's access to Pluto has been suspended by the central administration. Please contact support to resolve this.`
            : isActivatedUserWaiting 
            ? `Hello ${user?.firstName}! Your account is approved, but the system hasn't been activated by an administrator yet.`
            : isInstanceActivated
            ? `Hello ${user?.firstName}! The system is active for your organization, but your specific account requires approval from an administrator.`
            : `Hello ${user?.firstName}! Pluto has not been activated for your organization yet. Please wait for an administrator to complete the setup.`
          }
        </p>

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => refreshRole()}
          >
            Check Status Again
          </Button>

          {!isInstanceActivated && (
            <Link href="/setup" className="block">
              <Button variant="link" className="text-xs text-zinc-400 hover:text-blue-600">
                Are you the administrator? Activate Instance
              </Button>
            </Link>
          )}
          
          <SignOutButton>
            <Button variant="ghost" className="w-full text-zinc-500">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </SignOutButton>
        </div>

        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-zinc-400 font-medium uppercase tracking-widest">
          <ShieldAlert className="h-3 w-3" />
          Pluto Security Protocol
        </div>
      </div>
    </div>
  )
}

export default PendingApprovalPage
