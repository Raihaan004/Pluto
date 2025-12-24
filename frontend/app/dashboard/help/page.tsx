"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Book, FileText, Users, Settings, MessageCircle, ExternalLink } from "lucide-react"

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")

  const faqs = [
    {
      question: "How do I create a new project?",
      answer: "Navigate to the 'Projects' tab in the sidebar and click the 'Create New Project' button. You'll need to select a process template and version to get started."
    },
    {
      question: "How do I assign roles to users?",
      answer: "Go to the 'Admin' section (only available for Admins). Find the user in the list and use the dropdown menu to change their role to Viewer, Editor, or Admin."
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
      question: "How do notifications work?",
      answer: "You receive notifications when you are assigned a responsibility in a process or when important updates occur. Check the bell icon in the sidebar or the Notifications page."
    }
  ]

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto p-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 text-center py-8">
        <h1 className="text-4xl font-bold tracking-tight">How can we help you?</h1>
        <p className="text-muted-foreground text-lg">
          Search our knowledge base or browse common questions below.
        </p>
        <div className="relative max-w-xl mx-auto w-full mt-4">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search for help..." 
            className="pl-10 h-12 text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <Book className="h-8 w-8 text-blue-500 mb-2" />
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>New to Pluto? Start here to learn the basics.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <FileText className="h-8 w-8 text-green-500 mb-2" />
            <CardTitle>Process Guide</CardTitle>
            <CardDescription>Learn how to design and manage FuSa processes.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <Users className="h-8 w-8 text-purple-500 mb-2" />
            <CardTitle>User Management</CardTitle>
            <CardDescription>Managing teams, roles, and permissions.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* FAQs Section */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          {filteredFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No results found for "{searchQuery}"
            </div>
          )}
        </div>

        {/* Contact / Support Sidebar */}
        <div className="space-y-6">
          <Card className="bg-slate-50 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Need more help?
              </CardTitle>
              <CardDescription>
                Can't find what you're looking for? Our support team is here to help.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button className="w-full">Contact Support</Button>
              <Button variant="outline" className="w-full">
                View Documentation <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                All systems operational
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
