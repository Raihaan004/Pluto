"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Book, FileText, Users, MessageCircle, ExternalLink, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Particles } from "@/components/magicui/particles"

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ subject: "", message: "" })
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = [
    {
      id: "getting-started",
      title: "Getting Started",
      description: "New to Pluto? Start here to learn the basics.",
      icon: Book,
      color: "text-blue-500",
      content: [
        { title: "Creating your first project", text: "Click the 'Projects' tab and then 'Create New Project'. Choose a name and a process template to begin." },
        { title: "Managing Processes", text: "Design your functional safety workflows in the 'Process' tab. These serve as the master templates for your projects." },
        { title: "Understanding the Workspace", text: "Pluto is divided into Processes (templates) and Projects (instances of processes)." }
      ]
    },
    {
      id: "process-guide",
      title: "Process Guide",
      description: "Learn how to design and manage FuSa processes.",
      icon: FileText,
      color: "text-green-500",
      content: [
        { title: "Using the Process Editor", text: "Drag and drop nodes from the toolbox. Connect them by dragging from one handle to another." },
        { title: "Node Types", text: "Work Products (blue), Activities (yellow), Decisions (orange), and Processes (green) each have specific roles." },
        { title: "Versioning", text: "Always save a version before making major changes. This allows you to revert if needed." }
      ]
    },
    {
      id: "user-management",
      title: "User Management",
      description: "Managing teams, roles, and permissions.",
      icon: Users,
      color: "text-purple-500",
      content: [
        { title: "Roles & Permissions", text: "Admins can manage both global user roles and project-specific assignments via the Admin Console." },
        { title: "Assigning Responsibilities", text: "In the project editor, select a node and use the Properties Panel to assign a responsible user." },
        { title: "Collaborating", text: "Invite team members to your project via the 'Share' button in the project header or the 'Add Project to User' feature in Admin Console." }
      ]
    }
  ]

  const faqs = [
    {
      question: "How do I create a new project?",
      answer: "Navigate to the 'Projects' tab in the sidebar and click the 'Create New Project' button. You'll need to select a process template and version to get started."
    },
    {
      question: "How do I assign roles to users?",
      answer: "Go to the 'Admin Console' (only available for Admins). You can change a user's global role (Viewer, Editor, Admin) using the dropdown, or use the 'Add Project to User' button in the header to assign them to specific projects with custom permissions."
    },
    {
      question: "What is a Process Version?",
      answer: "A Process Version is a snapshot of a process workflow. When you make changes to a process, you can save it as a new version. Projects are always linked to a specific version of a process."
    },
    {
      question: "Can I delete a project?",
      answer: "Yes, you can delete a project from the Projects page. Click the trash icon on the project card. Please note that this action cannot be undone."
    },
    {
      question: "How do I export my process?",
      answer: "In the Process Editor, click the 'Download' icon in the toolbox to export your process as a JSON file. You can later 'Upload' it back."
    },
    {
      question: "What are Swim Lanes?",
      answer: "Swim Lanes are horizontal or vertical containers used to organize nodes by department, role, or stage. Use the 'Add Swim Lane' button in the toolbox."
    }
  ]

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulate API call
    setTimeout(() => {
      toast.success("Support request sent successfully!")
      setIsContactDialogOpen(false)
      setContactForm({ subject: "", message: "" })
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto p-8 pb-20 relative min-h-screen">
      <Particles
        className="absolute inset-0 z-0"
        quantity={150}
        staticity={50}
        color="#3b82f6"
      />
      
      <div className="relative z-10 flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-blue-600 text-white mx-auto mb-4 shadow-xl shadow-blue-200 animate-in zoom-in duration-500">
            <HelpCircle size={32} />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white uppercase italic">Pluto Help Center</h1>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto font-medium">
            Master the art of Functional Safety process design. Explore guides, tutorials, and expert support.
          </p>
          <div className="relative max-w-xl mx-auto w-full mt-10 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-hover:text-blue-500" />
            <Input 
              placeholder="Search for guides, shortcuts, or help..." 
              className="pl-14 h-16 text-lg rounded-2xl shadow-xl shadow-blue-50/50 border-gray-100 bg-white/80 backdrop-blur-sm focus:ring-4 focus:ring-blue-100 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Dialog key={cat.id}>
              <DialogTrigger asChild>
                <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer border-gray-100 bg-white/60 backdrop-blur-md rounded-3xl group overflow-hidden">
                  <CardHeader className="p-8">
                    <div className={cn("inline-flex p-3 rounded-2xl bg-white shadow-sm mb-4 transition-transform group-hover:scale-110", cat.color)}>
                      <cat.icon className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{cat.title}</CardTitle>
                    <CardDescription className="text-gray-500 font-medium text-sm mt-1">{cat.description}</CardDescription>
                  </CardHeader>
                </Card>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl border-none shadow-2xl rounded-3xl bg-white/95 backdrop-blur-xl">
                <DialogHeader className="p-6">
                  <DialogTitle className="flex items-center gap-4 text-3xl font-bold">
                    <div className={cn("p-3 rounded-2xl bg-white shadow-md", cat.color)}>
                      <cat.icon className="h-7 w-7" />
                    </div>
                    {cat.title}
                  </DialogTitle>
                  <DialogDescription className="text-base font-medium mt-2">{cat.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-8 p-6">
                  {cat.content.map((item, i) => (
                    <div key={i} className="space-y-3 group/item">
                      <h4 className="font-bold text-gray-900 text-lg flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-green-600" />
                        </div>
                        {item.title}
                      </h4>
                      <p className="text-gray-500 text-base leading-relaxed pl-9 font-medium">{item.text}</p>
                    </div>
                  ))}
                </div>
                <DialogFooter className="p-6 border-t font-bold uppercase tracking-widest text-xs">
                  <DialogClose asChild>
                    <Button variant="ghost" className="rounded-2xl px-8 hover:bg-gray-50">Close Guide</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        {/* FAQs Section */}
        <div className="mt-8">
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-4 border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 italic">QUICK SOLUTIONS</h2>
              <Badge className="bg-blue-50 text-blue-600 border-none font-bold px-4 py-1 text-xs">{filteredFaqs.length} ARTICLES</Badge>
            </div>
            
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="w-full space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-none rounded-2xl px-6 bg-white shadow-md shadow-gray-100/50 hover:shadow-xl hover:shadow-blue-50/50 transition-all overflow-hidden group">
                    <AccordionTrigger className="text-left font-bold text-gray-800 hover:no-underline py-6 text-lg group-data-[state=open]:text-blue-600 transition-colors">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-500 pb-6 leading-relaxed font-medium text-base border-t border-gray-50 pt-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-20 bg-white shadow-inner rounded-3xl border-2 border-dashed border-gray-100">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 uppercase">Nothing Found</h3>
                <p className="text-gray-400 font-medium">No results match your current query.</p>
                <Button variant="link" onClick={() => setSearchQuery("")} className="mt-4 text-blue-600 font-bold uppercase tracking-widest text-xs underline">Back to All Guides</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
