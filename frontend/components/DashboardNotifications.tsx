"use client"

import { useState } from "react"
import { Bell, CheckCircle, Info, AlertTriangle, Trash2, Check, X } from "lucide-react"
import axios from "axios"
import { useUser } from "@clerk/nextjs"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  created_at: string
  read: boolean
  metadata?: any
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export function DashboardNotifications() {
  const { user } = useUser()
  
  const { data: notifications = [], mutate } = useSWR<Notification[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/notifications/${user.id}` : null,
    fetcher
  )

  const markAsRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      mutate(
        notifications.map((n: Notification) => n.id === id ? { ...n, read: true } : n),
        false
      )
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`)
      mutate()
    } catch (error) {
      console.error('Error marking notification as read:', error)
      mutate()
    }
  }

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      mutate(
        notifications.filter((n: Notification) => n.id !== id),
        false
      )
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`)
      mutate()
    } catch (error) {
      console.error('Error deleting notification:', error)
      mutate()
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'invitation': return <Bell className="w-4 h-4 text-purple-500" />
      default: return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const unreadCount = notifications.filter((n: Notification) => !n.read).length

  return (
    <Card className="h-full border-none shadow-lg bg-white/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-white/50">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-blue-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </div>
          Notifications
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
          <Link href="/dashboard/notifications">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col divide-y divide-gray-100">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notification: Notification) => (
                <div 
                  key={notification.id} 
                  className={cn(
                    "group flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors relative",
                    !notification.read && "bg-blue-50/30"
                  )}
                >
                  <div className="mt-1 bg-white p-1.5 rounded-full shadow-sm border border-gray-100 shrink-0">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-16">
                    <p className={cn("text-sm font-medium text-gray-900 truncate", !notification.read && "font-semibold")}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  
                  {/* Actions - Visible on Hover */}
                  <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md p-1 shadow-sm border">
                    {!notification.read && (
                      <button 
                        onClick={(e) => markAsRead(e, notification.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => deleteNotification(e, notification.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                <div className="bg-gray-50 p-3 rounded-full mb-3">
                  <Bell className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm">No notifications</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
