import Link from "next/link"
import { ArrowRight, FileText, Users, Shield, Zap, CheckCircle, Globe, Cpu, Workflow, BarChart3, Layers, Cloud } from "lucide-react"
import { DotPattern } from "@/components/magicui/dot-pattern"
import { Particles } from "@/components/magicui/particles"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Marquee } from "@/components/magicui/marquee"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

const features = [
  {
    Icon: Workflow,
    name: "Interactive Process Modeling",
    description: "Design, version, and manage your Functional Safety processes with our intuitive drag-and-drop editor.",
    href: "/dashboard/process",
    cta: "Start Designing",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-1 lg:row-span-1 border-blue-100/50",
  },
  {
    Icon: Users,
    name: "Enterprise Collaboration",
    description: "Sync with your team in real-time. Assign roles (Admin, Editor, Viewer), track changes, and manage project versioning seamlessly.",
    href: "/dashboard/projects",
    cta: "Invite Team",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-2 lg:row-span-1 border-purple-100/50",
  },
  {
    Icon: Shield,
    name: "ISO 26262 Compliance",
    description: "Ensure your safety lifecycle meets rigorous automotive standards with built-in templates and documentation workflows.",
    href: "/dashboard/help",
    cta: "Learn Standards",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-1 lg:row-span-1 border-pink-100/50",
  },
  {
    Icon: Zap,
    name: "Jira Integration",
    description: "Automatically trigger Jira tickets from your process nodes. Connect your safety definitions directly to your engineering tasks.",
    href: "/dashboard/settings",
    cta: "Configure Sync",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-1 lg:row-span-1 border-amber-100/50",
  },
  {
    Icon: BarChart3,
    name: "System Heartbeat",
    description: "Monitor instance health and resource usage in real-time with centralized Pluto Admin connectivity.",
    href: "/dashboard/settings",
    cta: "View Health",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-1 lg:row-span-1 border-green-100/50",
  },
];

const reviews = [
  {
    name: "Marcus Chen",
    username: "@marcus_fusa",
    body: "Pluto has completely transformed how we handle ISO 26262 audits. The versioning control is second to none.",
    img: "https://avatar.vercel.sh/marcus",
  },
  {
    name: "Elena Rodriguez",
    username: "@elena_safety",
    body: "The Jira integration is a game-changer. Our process definitions and engineering tasks are finally in sync.",
    img: "https://avatar.vercel.sh/elena",
  },
  {
    name: "David Smith",
    username: "@dsmith_auto",
    body: "The visual editor is so intuitive. It was incredibly easy to migrate our legacy processes into Pluto.",
    img: "https://avatar.vercel.sh/david",
  },
  {
    name: "Sarah Kim",
    username: "@skim_safety",
    body: "The Pluto Admin dashboard gives us full visibility into our organization''s license and system health.",
    img: "https://avatar.vercel.sh/sarah",
  },
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

const ReviewCard = ({
  img,
  name,
  username,
  body,
}: {
  img: string;
  name: string;
  username: string;
  body: string;
}) => {
  return (
    <figure
      className={cn(
        "relative w-64 cursor-pointer overflow-hidden rounded-2xl border p-6 m-2",
        "border-slate-100 bg-white hover:bg-slate-50 hover:shadow-md transition-all duration-300",
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <img className="rounded-full shadow-sm" width="40" height="40" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-bold text-slate-900">
            {name}
          </figcaption>
          <p className="text-xs font-medium text-slate-400">{username}</p>
        </div>
      </div>
      <blockquote className="mt-4 text-sm leading-relaxed text-slate-600">{body}</blockquote>
    </figure>
  );
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white overflow-hidden scroll-smooth">
      <nav className="fixed top-0 z-50 w-full border-b bg-white/80 transition-all duration-300 backdrop-blur-md">
        <div className="container mx-auto flex h-20 items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur-sm opacity-25 group-hover:opacity-50 transition-opacity duration-300" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 font-bold text-white shadow-lg border border-white/20">
                P
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-tighter text-slate-900">
                PLUTO<span className="text-blue-600">.</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/80 mt-0.5">
                SAFETY ENGINE
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-8 mr-4">
              <Link href="#features" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Features</Link>
              <Link href="#testimonials" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Compliance</Link>
              <Link href="/dashboard/help" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Docs</Link>
            </nav>
            <div className="h-6 w-[1px] bg-slate-200 hidden md:block mr-2" />
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="ghost" className="hidden sm:inline-flex font-bold text-slate-700 hover:bg-slate-100">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200/50 px-6 rounded-full font-bold">Get Started</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button variant="ghost" className="font-bold text-slate-700 hover:bg-slate-100">Dashboard</Button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-20">
        <section className="relative overflow-hidden py-24 md:py-40 flex items-center justify-center min-h-[90vh]">
          <DotPattern
            width={24}
            height={24}
            cx={1}
            cy={1}
            cr={1}
            className={cn(
              "[mask-image:radial-gradient(ellipse_at_center,white,transparent)] opacity-40",
            )}
          />
          <Particles 
            className="absolute inset-0 z-0 pointer-events-none"
            quantity={120}
            staticity={30}
            color="#2563eb"
          />
          
          <div className="container relative z-10 px-6 lg:px-12 text-center">
            <div className="mb-10 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50/50 px-4 py-1.5 text-sm font-bold text-blue-700 backdrop-blur-sm shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
                v2.4: Jira Automation & Admin Console
              </div>
            </div>
            
            <h1 className="mx-auto max-w-5xl text-5xl font-black tracking-tight text-slate-900 sm:text-8xl leading-[1.05] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              Engineering <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent italic">Trust</span> in <br className="hidden md:block" />
              Functional Safety.
            </h1>
            
            <p className="mx-auto mt-10 max-w-2xl text-lg text-slate-600 md:text-2xl leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
              Pluto bridges the gap between safety requirements and engineering execution with ISO 26262 native workflows and real-time collaboration.
            </p>
            
            <div className="mt-14 flex flex-col items-center justify-center gap-6 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
              <Link href="/dashboard">
                <Button size="xl" className="h-16 px-10 bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-200/60 text-xl font-bold group rounded-2xl transition-all hover:scale-105 active:scale-95">
                  Get Started for Free
                  <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Button size="xl" variant="outline" className="h-16 px-10 border-slate-200 text-slate-700 hover:bg-slate-50 text-xl font-bold rounded-2xl bg-white/50 backdrop-blur-sm transition-all hover:scale-105">
                Book a Demo
              </Button>
            </div>
            
            <div className="mt-28 relative max-w-6xl mx-auto group animate-in zoom-in-95 duration-1000 delay-700">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-[2.5rem] blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative rounded-[2rem] border-8 border-slate-900 p-2 shadow-2xl bg-slate-950 overflow-hidden">
                <img 
                  src="/D-D.png" 
                  alt="Pluto Dashboard" 
                  className="rounded-2xl w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" 
                />
              </div>
            </div>
            
            <div className="mt-32 pt-12 border-t border-slate-100 flex flex-col items-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-10">Supporting Enterprise Safety Standards</p>
              <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-30 grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-60">
                <div className="flex items-center gap-2"><Cpu className="h-8 w-8" /><span className="font-bold text-xl">ASIL-D</span></div>
                <div className="flex items-center gap-2"><Workflow className="h-8 w-8" /><span className="font-bold text-xl">ISO 26262</span></div>
                <div className="flex items-center gap-2"><Globe className="h-8 w-8" /><span className="font-bold text-xl">IEC 61508</span></div>
                <div className="flex items-center gap-2"><Layers className="h-8 w-8" /><span className="font-bold text-xl">AUTOMOTIVE SPICE</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-slate-50 py-24 md:py-40 overflow-hidden relative">
          <div className="container px-6 lg:px-12">
            <div className="mb-24 text-center max-w-3xl mx-auto">
              <h2 className="text-blue-600 font-black text-xs tracking-[0.3em] uppercase mb-5">System Architecture</h2>
              <h3 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl leading-[1.1]">
                Modern engineering requires modern tools.
              </h3>
              <p className="mt-8 text-xl text-slate-600 font-medium leading-relaxed">
                Pluto isn''t just a dashboard - it''s a system of record for your entire functional safety lifecycle (FuSa).
              </p>
            </div>
            <BentoGrid className="grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <BentoCard 
                  key={feature.name} 
                  {...feature} 
                  className={cn(
                    feature.className, 
                    "group bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 border-none shadow-sm rounded-[2rem]"
                  )} 
                />
              ))}
            </BentoGrid>
          </div>
        </section>

        <section id="testimonials" className="py-24 md:py-40 bg-white">
          <div className="container px-6 lg:px-12">
            <div className="mb-20 text-center">
              <h3 className="text-4xl font-black tracking-tighter text-slate-900 sm:text-5xl">
                The New Standard in Safety <br className="hidden sm:block" /> Engineering Excellence.
              </h3>
            </div>
            <div className="relative flex min-h-[22rem] w-full flex-col items-center justify-center overflow-hidden rounded-[3rem] border border-slate-100 bg-slate-50/50 p-4 md:shadow-inner">
              <Marquee pauseOnHover className="[--duration:30s]">
                {reviews.map((review) => (
                  <ReviewCard key={review.username} {...review} />
                ))}
              </Marquee>
              <Marquee reverse pauseOnHover className="[--duration:25s] mt-6">
                {reviews.map((review) => (
                  <ReviewCard key={review.username} {...review} />
                ))}
              </Marquee>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-slate-50/80"></div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-slate-50/80"></div>
            </div>
          </div>
        </section>

        <section className="py-24 md:py-40 px-6">
          <div className="container max-w-6xl mx-auto">
            <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] py-20 px-10 text-center shadow-3xl">
              <Particles 
                className="absolute inset-0 z-0 opacity-20"
                quantity={80}
                color="#ffffff"
              />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">
                  Ready to secure your <br /> next ISO audit?
                </h2>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 font-medium">
                  Join industry leaders who have switched to Pluto to automate their safety lifecycle management.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/dashboard">
                    <Button size="xl" className="h-16 px-10 bg-white text-slate-900 hover:bg-slate-100 text-xl font-bold rounded-2xl shadow-xl transition-transform hover:scale-105">
                      Get Started Now
                    </Button>
                  </Link>
                  <Button size="xl" variant="outline" className="h-16 px-10 border-slate-700 text-white hover:bg-slate-800 text-xl font-bold rounded-2xl transition-transform hover:scale-105">
                    Contact Sales
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-100 bg-slate-50 py-20">
          <div className="container px-6 lg:px-12">
            <div className="flex flex-col md:flex-row justify-between gap-12">
              <div className="flex flex-col gap-6 max-w-xs transition-opacity hover:opacity-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-bold text-white shadow-lg">
                    P
                  </div>
                  <span className="text-xl font-black text-slate-900">PLUTO</span>
                </div>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  The Enterprise Operating System for Functional Safety Management and Compliance.
                </p>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer italic font-black">X</div>
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer italic font-black">in</div>
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer italic font-black">gh</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 md:gap-24">
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Product</h4>
                  <Link href="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Platform</Link>
                  <Link href="#features" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Features</Link>
                  <Link href="/dashboard/settings" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Jira Sync</Link>
                </div>
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Resources</h4>
                  <Link href="/dashboard/help" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Documentation</Link>
                  <Link href="/dashboard/settings" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Admin API</Link>
                  <Link href="/dashboard/help" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Tutorials</Link>
                </div>
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Company</h4>
                  <Link href="#" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Privacy</Link>
                  <Link href="#" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Terms</Link>
                  <Link href="/dashboard/settings" className="text-sm font-semibold text-slate-500 hover:text-blue-600">Security</Link>
                </div>
              </div>
            </div>
            
            <div className="mt-20 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs font-bold text-slate-400"> 2024 Pluto Safety Systems. Built for the future of mobility.</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-slate-500">All systems operational</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
