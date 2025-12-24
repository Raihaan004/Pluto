import { auth } from "@clerk/nextjs/server"
import { UserSync } from "@/components/UserSync"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell, FileText, Calendar, FileInput } from "lucide-react"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { AnimatedList } from "@/components/magicui/animated-list"
import { cn } from "@/lib/utils"

// Mock data fetcher since we might not have the backend running perfectly yet
async function getDashboardData(userId: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard-stats/${userId}`, {
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  } catch (error) {
    return {
      tasks_assigned: 0,
      projects_pending: 0,
      notifications: []
    }
  }
}

interface NotificationItem {
  name: string;
  description: string;
  icon: string;
  color: string;
  time: string;
}

const Notification = ({ name, description, icon, color, time }: NotificationItem) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit w-full max-w-100 cursor-pointer overflow-hidden rounded-2xl p-4",
        // animation styles
        "transition-all duration-200 ease-in-out hover:scale-[1.03]",
        // light styles
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: color,
          }}
        >
          <span className="text-lg">{icon}</span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white ">
            <span className="text-sm sm:text-lg">{name}</span>
            <span className="mx-1">·</span>
            <span className="text-xs text-gray-500">{time}</span>
          </figcaption>
          <p className="text-sm font-normal dark:text-white/60">
            {description}
          </p>
        </div>
      </div>
    </figure>
  );
};

export default async function DashboardPage() {
  const { userId } = await auth()
  const data = await getDashboardData(userId || "")

  const features = [
    {
      Icon: FileText,
      name: "Tasks Assigned",
      description: "Tasks requiring your attention",
      href: "/dashboard/tasks",
      cta: "View Tasks",
      background: <div className="absolute -right-20 -top-20 opacity-60" />,
      className: "lg:col-span-1 lg:row-span-1",
      value: data.tasks_assigned
    },
    {
      Icon: FileInput,
      name: "Pending Projects",
      description: "Projects in progress",
      href: "/dashboard/projects",
      cta: "View Projects",
      background: <div className="absolute -right-20 -top-20 opacity-60" />,
      className: "lg:col-span-1 lg:row-span-1",
      value: data.projects_pending
    },
    {
      Icon: Calendar,
      name: "Upcoming Deadlines",
      description: "Stay on top of your schedule",
      href: "/dashboard/calendar",
      cta: "View Calendar",
      background: <div className="absolute -right-20 -top-20 opacity-60" />,
      className: "lg:col-span-1 lg:row-span-1",
      value: "3" // Mock value
    },
  ];

  // Transform notifications for AnimatedList
  const notifications = data.notifications.length > 0 ? data.notifications.map((n: any) => ({
    name: "System",
    description: n.message,
    time: n.time,
    icon: "🔔",
    color: "#00C9A7",
  })) : [
    {
      name: "System",
      description: "Welcome to Pluto!",
      time: "Just now",
      icon: "👋",
      color: "#FFB800",
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <UserSync />
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Main Content - Stats with Bento Grid */}
        <div className="col-span-2 flex flex-col gap-6">
          <BentoGrid className="lg:grid-rows-1">
            {features.map((feature) => (
              <BentoCard 
                key={feature.name} 
                {...feature} 
                description={`${feature.description} (${feature.value})`}
              />
            ))}
          </BentoGrid>
          
          {/* Placeholder for other dashboard content */}
          <Card className="h-64 flex items-center justify-center text-muted-foreground bg-white/50 backdrop-blur-sm">
            Chart or Activity Feed Placeholder
          </Card>
        </div>

        {/* Right Side - Notifications with Animated List */}
        <div className="col-span-1">
          <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="border-b pb-4 px-0">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 px-0">
              <div className="relative flex h-125 w-full flex-col p-6 overflow-hidden rounded-lg border bg-background md:shadow-xl">
                <AnimatedList>
                  {notifications.map((item: NotificationItem, idx: number) => (
                    <Notification {...item} key={idx} />
                  ))}
                </AnimatedList>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
