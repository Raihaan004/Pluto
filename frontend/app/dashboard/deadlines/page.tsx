'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, Briefcase, Users, ArrowRight, ExternalLink, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/calendar/events/${user.id}`);
        const events = response.data.map((event: any) => ({ ...event, date: new Date(event.date) }));
        setDeadlines(events);
      } catch (error) {
        console.error("Failed to fetch deadlines:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  // Sort deadlines by date (nearest first)
  const sortedDeadlines = [...deadlines].sort((a, b) => a.date.getTime() - b.date.getTime());

  const getDeadlineStatus = (date: Date) => {
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200' };
    if (diffDays === 0) return { label: 'Due Today', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (diffDays <= 3) return { label: `Due in ${diffDays} days`, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { label: `Due in ${diffDays} days`, color: 'bg-blue-100 text-blue-700 border-blue-200' };
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Clock className="w-6 h-6" />
          </div>
          Deadlines
        </h1>
        <p className="text-gray-500 text-lg">Manage your schedule and upcoming task deadlines.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedDeadlines.length === 0 ? (
        <Card className="border-dashed border-2 bg-gray-50/50">
          <CardContent className="p-12 text-center flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-full shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All caught up!</h3>
              <p className="text-gray-500">You don't have any upcoming deadlines at the moment.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedDeadlines.map((deadline) => {
            const status = getDeadlineStatus(deadline.date);
            return (
              <Card key={deadline.id} className="group hover:shadow-md transition-all duration-200 border-gray-200 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn("p-3 rounded-xl shrink-0", 
                      deadline.type === 'project' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    )}>
                      {deadline.type === 'project' ? <Briefcase className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900 truncate">{deadline.title}</h3>
                        <Badge variant="outline" className={cn("font-medium", status.color)}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {deadline.project_name}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {format(deadline.date, 'PPP')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                      onClick={() => router.push(deadline.route)}
                    >
                      View Project
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
