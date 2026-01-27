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
  const { isVerified, loading, role } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isVerified) {
      router.push("/setup")
    }
  }, [loading, isVerified, router])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // If not verified, we show nothing (or the loading state) while redirecting
  if (!isVerified) {
    return null
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
