'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle, Trash2, ExternalLink, Check, X } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  metadata?: any;
}

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'invitation':
      return <Bell className="w-5 h-5 text-purple-500" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
  }
};

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function NotificationsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  
  const { data: notifications = [], error, isLoading, mutate } = useSWR<Notification[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/notifications/${user.id}` : null,
    fetcher
  );

  const markAsRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      // Optimistic update
      mutate(
        notifications.map((n: Notification) => n.id === id ? { ...n, read: true } : n),
        false
      );
      
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`);
      mutate(); // Revalidate
    } catch (error) {
      console.error('Error marking notification as read:', error);
      mutate(); // Revert on error
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm("Are you sure you want to delete this notification?")) return;

    setDeletingIds(prev => new Set(prev).add(id));
    
    try {
      // Optimistically update the UI
      mutate(notifications.filter((n: Notification) => n.id !== id), false);

      // Send delete request to the backend
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`);

      // Revalidate the data to ensure consistency with the backend
      mutate();
    } catch (error: any) {
      console.error('Error deleting notification:', error);

      // Revert the optimistic update on error by re-fetching the original data
      mutate();
      
      // Show more detailed error message
      const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error';
      alert(`Failed to delete notification: ${errorMessage}`);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleAccept = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/accept`);
        alert("Invitation accepted! You have been added to the project.");
        mutate();
    } catch (error) {
        console.error("Error accepting invitation:", error);
        alert("Failed to accept invitation.");
    }
  };

  const handleReject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/reject`);
        mutate();
    } catch (error) {
        console.error("Error rejecting invitation:", error);
    }
  };

  const handleViewProject = (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      router.push(`/dashboard/projects/editor?projectId=${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-blue-600 text-white">
                {unreadCount} unread
              </Badge>
            )}
          </h1>
          <p className="text-gray-500 mt-2">Stay updated with your project activities and assignments</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-gray-500 text-center max-w-md">
              You'll see notifications here when you're assigned tasks, invited to projects, or receive updates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification: Notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all duration-200 hover:shadow-md ${
                !notification.read ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
              } ${deletingIds.has(notification.id) ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <CardContent className="p-5">
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      notification.type === 'success' ? 'bg-green-100' :
                      notification.type === 'warning' ? 'bg-yellow-100' :
                      notification.type === 'invitation' ? 'bg-purple-100' :
                      'bg-blue-100'
                    }`}>
                      <NotificationIcon type={notification.type} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-base font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{notification.message}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-500 mb-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                      {notification.type === 'invitation' && !notification.read && (
                        <>
                          <Button 
                            onClick={(e) => handleAccept(e, notification.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-8 gap-2"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </Button>
                          <Button 
                            onClick={(e) => handleReject(e, notification.id)}
                            size="sm"
                            variant="destructive"
                            className="h-8 gap-2"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </>
                      )}

                      {notification.metadata?.project_id && (
                        <Button
                          onClick={(e) => handleViewProject(e, notification.metadata.project_id)}
                          size="sm"
                          variant="outline"
                          className="h-8 gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Project
                        </Button>
                      )}

                      {!notification.read && (
                        <Button
                          onClick={(e) => markAsRead(e, notification.id)}
                          size="sm"
                          variant="ghost"
                          className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-2"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark as Read
                        </Button>
                      )}

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          deleteNotification(e, notification.id);
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 ml-auto"
                        disabled={deletingIds.has(notification.id)}
                        title="Delete notification"
                        type="button"
                      >
                        {deletingIds.has(notification.id) ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

