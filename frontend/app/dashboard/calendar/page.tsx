'use client';

import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, Briefcase, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock data for deadlines
// In a real app, this would come from your backend
const deadlines = [
  { id: 1, title: 'Project Alpha Review', date: new Date(2025, 11, 28), type: 'project', route: '/dashboard/projects' }, // Dec 28, 2025
  { id: 2, title: 'Update Documentation', date: new Date(2025, 11, 30), type: 'task', route: '/dashboard/tasks' }, // Dec 30, 2025
  { id: 3, title: 'Team Meeting', date: new Date(2026, 0, 5), type: 'meeting', route: '#' }, // Jan 5, 2026
  { id: 4, title: 'Q4 Report Due', date: new Date(2025, 11, 31), type: 'task', route: '/dashboard/tasks' }, // Dec 31, 2025
  { id: 5, title: 'New Year Kickoff', date: new Date(2026, 0, 1), type: 'meeting', route: '#' }, // Jan 1, 2026
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventStyles = (type: string) => {
    switch (type) {
      case 'project':
        return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200';
      case 'task':
        return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
      case 'meeting':
        return 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Briefcase className="w-3 h-3 mr-1" />;
      case 'task':
        return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'meeting':
        return <Users className="w-3 h-3 mr-1" />;
      default:
        return <Clock className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            Calendar
          </h1>
          <p className="text-gray-500 mt-2">Manage your schedule and upcoming deadlines.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={goToToday} className="hidden sm:flex">Today</Button>
          <div className="flex items-center bg-white rounded-lg shadow-sm border p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-40 text-center font-semibold text-gray-700 select-none">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="flex-grow flex flex-col overflow-hidden border-0 shadow-xl ring-1 ring-gray-200 sm:rounded-xl">
        <CardContent className="p-0 flex-grow flex flex-col h-full">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b bg-gray-50/80 backdrop-blur-sm">
            {weekDays.map((day) => (
              <div key={day} className="py-4 text-center font-semibold text-gray-500 text-xs uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 flex-grow auto-rows-fr bg-white">
            {calendarDays.map((day, dayIdx) => {
              const dayDeadlines = deadlines.filter(d => isSameDay(d.date, day));
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);
              
              return (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "min-h-[120px] p-3 border-b border-r relative transition-all duration-200 flex flex-col gap-2 group",
                    !isCurrentMonth && "bg-gray-50/50 text-gray-400",
                    isTodayDate && "bg-blue-50/30",
                    "hover:bg-gray-50"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span 
                      className={cn(
                        "text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                        isTodayDate 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                          : "text-gray-700 group-hover:bg-gray-200"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayDeadlines.length > 0 && (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {dayDeadlines.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[120px] custom-scrollbar">
                    {dayDeadlines.map((deadline) => (
                      <div 
                        key={deadline.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deadline.route && deadline.route !== '#') {
                            router.push(deadline.route);
                          }
                        }}
                        className={cn(
                          "text-xs px-2 py-1.5 rounded-md truncate cursor-pointer shadow-sm border transition-all duration-200 flex items-center",
                          "hover:shadow-md hover:scale-[1.02] active:scale-95",
                          getEventStyles(deadline.type)
                        )}
                        title={`${deadline.title} - Click to view`}
                      >
                        {getEventIcon(deadline.type)}
                        <span className="truncate font-medium">{deadline.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
