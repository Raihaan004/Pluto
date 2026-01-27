"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/context/UserRoleContext"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Shield, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export default function SetupPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { isVerified, refreshRole } = useUserRole()
  
  const [formData, setFormData] = useState({
    orgName: "",
    licenseId: "",
    emailId: ""
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in")
    }
    if (isVerified) {
      router.push("/dashboard")
    }
  }, [isLoaded, user, isVerified, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Validation: Name must be caps
    if (formData.orgName !== formData.orgName.toUpperCase()) {
      setError("Organization Name must be in ALL CAPS.")
      setSubmitting(false)
      return
    }

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/verify-license`, {
        clerk_id: user?.id,
        org_name: formData.orgName,
        license_id: formData.licenseId,
        email_id: formData.emailId
      })

      if (response.data.status === "verified") {
        toast.success("License verified successfully!")
        await refreshRole()
        router.push("/dashboard")
      }
    } catch (err: any) {
      console.error("Verification failed:", err)
      const message = err.response?.data?.detail || "Verification failed. Please check your details."
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoaded || isVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg shadow-blue-500/20">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Verify Your License</h1>
          <p className="text-zinc-500 mt-2">Activate your Pluto instance with your organization details</p>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Onboarding Details</CardTitle>
              <CardDescription>Enter the data provided in your Pluto Admin panel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name (CAPS ONLY)</Label>
                <Input
                  id="orgName"
                  placeholder="E.G. PLUTO INC"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value.toUpperCase() })}
                  required
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailId">Admin Email Address</Label>
                <Input
                  id="emailId"
                  type="email"
                  placeholder="admin@yourcompany.com"
                  value={formData.emailId}
                  onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseId">License ID (15 Characters)</Label>
                <Input
                  id="licenseId"
                  placeholder="XXXX-XXXX-XXXX"
                  value={formData.licenseId}
                  onChange={(e) => setFormData({ ...formData, licenseId: e.target.value })}
                  required
                  className="font-mono"
                  maxLength={15}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Activate License
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-zinc-500 mt-6">
          Need help? Contact <a href="mailto:support@pluto.com" className="text-blue-600 hover:underline">support@pluto.com</a>
        </p>
      </div>
    </div>
  )
}
