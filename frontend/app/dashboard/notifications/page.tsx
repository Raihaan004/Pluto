'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle, Trash2, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      mutate(
        notifications.filter((n: Notification) => n.id !== id),
        false
      );
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`);
      mutate();
    } catch (error) {
      console.error('Error deleting notification:', error);
      mutate();
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
    return <div className="p-8 text-center">Loading notifications...</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notifications
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No notifications yet.</div>
        ) : (
            notifications.map((notification: Notification) => (
            <div 
                key={notification.id} 
                className={`p-4 flex gap-4 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/50' : ''}`}
            >
                <div className="flex-shrink-0 mt-1">
                <NotificationIcon type={notification.type} />
                </div>
                <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className={`font-medium ${!notification.read ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                    {notification.title}
                    </h3>
                    <span className="text-xs text-gray-500">{new Date(notification.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                
                <div className="mt-3 flex flex-wrap gap-2">
                    {notification.type === 'invitation' && !notification.read && (
                        <>
                            <Button 
                                onClick={(e) => handleAccept(e, notification.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-8"
                            >
                                Accept
                            </Button>
                            <Button 
                                onClick={(e) => handleReject(e, notification.id)}
                                size="sm"
                                variant="destructive"
                                className="h-8"
                            >
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
                            <ExternalLink className="w-3 h-3" />
                            View Project
                        </Button>
                    )}

                    {!notification.read && (
                        <Button
                            onClick={(e) => markAsRead(e, notification.id)}
                            size="sm"
                            variant="ghost"
                            className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                            Mark as Read
                        </Button>
                    )}

                    <Button
                        onClick={(e) => deleteNotification(e, notification.id)}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
                </div>
                {!notification.read && (
                <div className="flex-shrink-0 self-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                )}
            </div>
            ))
        )}
      </div>
    </div>
  );
}

