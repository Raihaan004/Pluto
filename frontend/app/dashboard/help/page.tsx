"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Book, FileText, Users, Settings, MessageCircle, ExternalLink, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
    <div className="flex flex-col gap-8 max-w-6xl mx-auto p-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-4 text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto mb-4">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">How can we help you?</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Everything you need to know about Pluto. Search our knowledge base or browse common questions below.
        </p>
        <div className="relative max-w-xl mx-auto w-full mt-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search for help, guides, or FAQs..." 
            className="pl-12 h-14 text-lg shadow-sm border-gray-200 focus:ring-blue-500"
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
              <Card className="hover:shadow-md transition-all cursor-pointer border-gray-200 hover:border-blue-200 group">
                <CardHeader>
                  <cat.icon className={cn("h-10 w-10 mb-2 transition-transform group-hover:scale-110", cat.color)} />
                  <CardTitle className="group-hover:text-blue-600 transition-colors">{cat.title}</CardTitle>
                  <CardDescription>{cat.description}</CardDescription>
                </CardHeader>
              </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <cat.icon className={cat.color} />
                  {cat.title}
                </DialogTitle>
                <DialogDescription>{cat.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {cat.content.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-500" />
                      {item.title}
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* FAQs Section */}
      <div className="grid gap-10 md:grid-cols-3 mt-4">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
            <span className="text-sm text-muted-foreground">{filteredFaqs.length} articles</span>
          </div>
          
          {filteredFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-3">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border rounded-xl px-4 bg-white shadow-sm">
                  <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 pb-4 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No results found</h3>
              <p className="text-muted-foreground">We couldn't find any articles matching "{searchQuery}"</p>
              <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">Clear search</Button>
            </div>
          )}
        </div>

        {/* Contact / Support Sidebar */}
        <div className="space-y-6">
          <Card className="bg-blue-600 text-white border-none shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MessageCircle size={80} />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageCircle className="h-5 w-5" />
                Need more help?
              </CardTitle>
              <CardDescription className="text-blue-100">
                Can't find what you're looking for? Our support team is here to help.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 relative z-10">
              <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 border-none font-semibold">
                    Contact Support
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleContactSubmit}>
                    <DialogHeader>
                      <DialogTitle>Contact Support</DialogTitle>
                      <DialogDescription>
                        Send us a message and we'll get back to you as soon as possible.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input 
                          id="subject" 
                          placeholder="What do you need help with?" 
                          required
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea 
                          id="message" 
                          placeholder="Describe your issue in detail..." 
                          className="min-h-30"
                          required
                          value={contactForm.message}
                          onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit">Send Message</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="w-full bg-transparent border-blue-400 text-white hover:bg-blue-700">
                View Documentation <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500">
                <Settings className="h-4 w-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  Operational
                </div>
                <span className="text-xs text-gray-400">Updated 2m ago</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
