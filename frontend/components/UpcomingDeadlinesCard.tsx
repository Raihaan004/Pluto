'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { Calendar, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface Deadline {
  id: string;
  title: string;
  date: string;
  route: string;
}

export const UpcomingDeadlinesCard = () => {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    const fetchDeadlines = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/calendar/events/${user.id}`);
        const sortedDeadlines = response.data
          .map((d: any) => ({ ...d, date: new Date(d.date) }))
          .sort((a: any, b: any) => a.date - b.date)
          .slice(0, 5); // Get top 5 upcoming
        setDeadlines(sortedDeadlines);
      } catch (error) {
        console.error("Failed to fetch deadlines for dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
  }, [user]);

  return (
    <div className="p-6 h-full">
      <h3 className="font-semibold text-lg mb-4 flex items-center"><Calendar className="w-5 h-5 mr-2"/> Upcoming Deadlines</h3>
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : deadlines.length === 0 ? (
        <p className="text-sm text-gray-500 text-center mt-8">No upcoming deadlines.</p>
      ) : (
        <div className="space-y-4">
          {deadlines.map(deadline => (
            <Link href={deadline.route} key={deadline.id} className="block hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center w-12 h-12 bg-pink-100 text-pink-700 rounded-lg font-bold">
                  <span className="text-sm">{format(deadline.date, 'MMM')}</span>
                  <span className="text-xl">{format(deadline.date, 'd')}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm truncate">{deadline.title}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(deadline.date, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
