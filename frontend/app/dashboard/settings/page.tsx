"use client"

import { useState, useEffect } from "react"
import { useUserRole } from "@/context/UserRoleContext"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Loader2, User, Shield, Building, Mail, Bell, Moon, Sun, Globe, Smartphone, Lock, Trash2, Download, Database, FileArchive, Clock, Settings2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SettingsPage() {
  const { user } = useUser()
  const { role, organization, approvalStatus } = useUserRole()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupProgress, setBackupProgress] = useState(0)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  // JIRA Config State
  const [jiraUrl, setJiraUrl] = useState("")
  const [jiraEmail, setJiraEmail] = useState("")
  const [jiraApiToken, setJiraApiToken] = useState("")
  const [isSavingJira, setIsSavingJira] = useState(false)

  useEffect(() => {
    if (role === 'admin') {
      fetchJiraConfig()
    }
  }, [role])

  const fetchJiraConfig = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/jira-config`)
      if (response.ok) {
        const data = await response.json()
        setJiraUrl(data.jira_url || "")
        setJiraEmail(data.jira_email || "")
        setJiraApiToken(data.jira_api_token || "")
      }
    } catch (error) {
      console.error("Failed to fetch JIRA config:", error)
    }
  }

  const handleSaveJira = async () => {
    setIsSavingJira(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/jira-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jira_url: jiraUrl,
          jira_email: jiraEmail,
          jira_api_token: jiraApiToken,
        }),
      })

      if (response.ok) {
        toast.success("JIRA configuration updated successfully")
      } else {
        toast.error("Failed to save JIRA configuration")
      }
    } catch (error) {
      console.error("Error saving JIRA config:", error)
      toast.error("An error occurred while saving JIRA configuration")
    } finally {
      setIsSavingJira(false)
    }
  }

  const handleSave = () => {
    setIsUpdating(true)
    setTimeout(() => {
      setIsUpdating(false)
      toast.success("Settings saved successfully")
    }, 800)
  }

  const handleBackup = async () => {
    setIsBackingUp(true)
    setBackupProgress(10)
    
    try {
      const updateProgress = (val: number) => {
        setBackupProgress(prev => Math.min(prev + val, 95))
      }
      
      const interval = setInterval(() => updateProgress(15), 500)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/export-backup`)
      
      clearInterval(interval)
      
      if (!response.ok) throw new Error("Backup failed on server")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `pluto_full_backup_${timestamp}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setBackupProgress(100)
      setLastBackup(new Date().toLocaleString())
      toast.success("Full system backup downloaded successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to generate backup")
    } finally {
      setTimeout(() => {
        setIsBackingUp(false)
        setBackupProgress(0)
      }, 1000)
    }
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center">
      <div className="w-full max-w-5xl py-10 px-6 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-left">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">Settings</h1>
            <p className="text-muted-foreground text-lg">
              Manage your account preferences and system configurations.
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6 w-full">
          <div className="flex justify-start">
            <TabsList className="bg-muted/50 p-1 border">
              <TabsTrigger value="profile" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-8">Profile</TabsTrigger>
              {role === 'admin' && (
                <TabsTrigger value="jira" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-8">JIRA Config</TabsTrigger>
              )}
              <TabsTrigger value="backup" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-8">Backup</TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-8">Security</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="space-y-6 outline-none mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <User className="w-5 h-5 text-blue-600" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Update your personal identity details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" defaultValue={user?.firstName || ""} placeholder="John" className="focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" defaultValue={user?.lastName || ""} placeholder="Doe" className="focus-visible:ring-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email address
                    </Label>
                    <Input id="email" defaultValue={user?.emailAddresses[0]?.emailAddress || ""} disabled className="bg-muted/30" />
                    <p className="text-[12px] text-muted-foreground italic">Email managed via Clerk Authentication.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Organizational Context
                  </CardTitle>
                  <CardDescription>Your current access levels and assignment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Current Role</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/20 border-blue-100">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="font-semibold capitalize text-blue-700">{role || "Viewer"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      Organization
                    </Label>
                    <Input value={organization || "Pluto Design Group"} disabled className="bg-muted/30" />
                  </div>
                  <div className="pt-2">
                    <div className="text-sm border-l-4 border-purple-500 pl-3 py-1 bg-purple-50 text-purple-800 rounded-r-md">
                      Verification Status: <span className="font-bold underline">{approvalStatus || "Approved"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {role === 'admin' && (
            <TabsContent value="jira" className="outline-none mt-0">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Settings2 className="w-5 h-5 text-indigo-600" />
                    JIRA Integration
                  </CardTitle>
                  <CardDescription>Configure your organization&apos;s JIRA workspace settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jiraUrl">JIRA URL</Label>
                      <Input 
                        id="jiraUrl" 
                        value={jiraUrl} 
                        onChange={(e) => setJiraUrl(e.target.value)}
                        placeholder="https://your-org.atlassian.net" 
                        className="focus-visible:ring-indigo-500" 
                      />
                      <p className="text-[12px] text-muted-foreground italic">Your organization&apos;s Atlassian JIRA instance URL.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jiraEmail">Admin Email</Label>
                      <Input 
                        id="jiraEmail" 
                        value={jiraEmail}
                        onChange={(e) => setJiraEmail(e.target.value)}
                        placeholder="admin@example.com" 
                        className="focus-visible:ring-indigo-500" 
                      />
                      <p className="text-[12px] text-muted-foreground italic">The email address associated with your JIRA API Token.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jiraToken">JIRA API Token</Label>
                      <Input 
                        id="jiraToken" 
                        type="password"
                        value={jiraApiToken}
                        onChange={(e) => setJiraApiToken(e.target.value)}
                        placeholder="••••••••••••••••••••••••" 
                        className="focus-visible:ring-indigo-500 font-mono text-sm" 
                      />
                      <p className="text-[12px] text-muted-foreground italic">Your secure JIRA API token. Can be generated in Atlassian account settings.</p>
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button 
                      onClick={handleSaveJira} 
                      disabled={isSavingJira}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]"
                    >
                      {isSavingJira ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                      Save JIRA Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="backup" className="space-y-6 outline-none mt-0 animate-in slide-in-from-left-2 duration-300">
            <div className="grid gap-6">
              <Card className="shadow-sm border-blue-100 overflow-hidden">
                <div className="h-1 bg-blue-600 w-full" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Database className="w-5 h-5 text-blue-600" />
                    System Data Export
                  </CardTitle>
                  <CardDescription>Generate a complete backup of all projects, processes, and historical versions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                  <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-6 flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-full hidden sm:block">
                       <FileArchive className="w-6 h-6 text-blue-700" />
                    </div>
                    <div className="flex-1 space-y-2">
                       <h4 className="font-semibold text-blue-900 leading-none">Full Workspace Backup</h4>
                       <p className="text-sm text-blue-700/80 leading-relaxed italic">
                          This will generate a consolidated <strong>.zip</strong> archive containing all your organizational data, including every process design (Draft and Published) and their complete version histories.
                       </p>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 active:scale-95 transition-all"
                        onClick={() => toast.info("Import feature coming soon")}
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Restore from ZIP
                      </Button>
                      <Button 
                        onClick={handleBackup} 
                        disabled={isBackingUp}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95 transition-all min-w-[140px]"
                      >
                        {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                        {isBackingUp ? "Packing..." : "Export as ZIP"}
                      </Button>
                    </div>
                  </div>

                  {isBackingUp && (
                    <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                      <div className="flex justify-between text-xs font-medium text-blue-700 uppercase tracking-widest">
                        <span>Compiling Data...</span>
                        <span>{backupProgress}%</span>
                      </div>
                      <Progress value={backupProgress} className="h-2 bg-blue-100" />
                    </div>
                  )}

                  <div className="flex items-center gap-6 pt-2">
                     <div className="flex items-center gap-2 text-sm text-muted-foreground group">
                        <Clock className="w-4 h-4 group-hover:text-blue-600 transition-colors" />
                        <span>Last backup: <strong>{lastBackup || "Never"}</strong></span>
                     </div>
                     <Separator orientation="vertical" className="h-4" />
                     <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        Cloud sync active
                     </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-100 bg-gray-50/30">
                <CardContent className="pt-6">
                   <div className="flex items-start gap-3">
                      <div className="bg-amber-100 p-2 rounded-lg mt-1">
                         <Lock className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="space-y-1">
                         <h5 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Security Notice</h5>
                         <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                            Backup files contain sensitive organizational data and logic. Ensure you store these files in a secure, encrypted storage location. Pluto does not store passwords in export data; however, process flows may contain proprietary business logic.
                         </p>
                      </div>
                   </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 outline-none">
            <Card className="shadow-sm border-red-100">
              <CardHeader className="bg-red-50/30">
                <CardTitle className="flex items-center gap-2 text-xl text-red-900 border-b-0">
                  <Lock className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-700/70 italic">Critical account actions and data management.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 bg-white rounded-b-xl border-t border-red-100">
                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-red-900">Sign out from all devices</Label>
                    <p className="text-sm text-muted-foreground italic text-red-700/60">Log out of every active session across all browsers.</p>
                  </div>
                  <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 transition-all">Sign Out All</Button>
                </div>
                <Separator className="bg-red-100" />
                <div className="flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-red-900 underline decoration-red-200">Deactivate Account</Label>
                    <p className="text-sm text-muted-foreground italic text-red-700/60 font-medium">Permanently delete your profile and project contributions.</p>
                  </div>
                  <Button variant="destructive" className="bg-red-600 hover:bg-red-700 shadow-sm transition-all active:scale-95 flex gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="pt-6 text-center">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Shield className="w-3 h-3" />
            Security Powered by Pluto Systems v2.4
          </p>
        </div>
      </div>
    </div>
  )
}
