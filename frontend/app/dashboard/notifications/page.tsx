'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import useSWR from 'swr';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
  }
};

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function NotificationsPage() {
  const { user } = useUser();
  
  const { data: notifications = [], error, isLoading, mutate } = useSWR(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/notifications/${user.id}` : null,
    fetcher
  );

  const markAsRead = async (id: number) => {
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

  if (isLoading) {
    return <div className="p-8 text-center">Loading notifications...</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl">
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
                onClick={() => !notification.read && markAsRead(notification.id)}
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

