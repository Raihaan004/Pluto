import Link from "next/link"
import { ArrowRight, FileText, Users, Shield, Zap, CheckCircle, Globe } from "lucide-react"
import { DotPattern } from "@/components/magicui/dot-pattern"
import { Particles } from "@/components/magicui/particles"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { Marquee } from "@/components/magicui/marquee"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

const features = [
  {
    Icon: FileText,
    name: "Process Management",
    description: "Design, version, and manage your FuSa processes with our intuitive drag-and-drop editor.",
    href: "/dashboard/process",
    cta: "Start Designing",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-1 lg:row-span-1",
  },
  {
    Icon: Users,
    name: "Real-time Collaboration",
    description: "Work together with your team in real-time. Assign roles, track changes, and communicate seamlessly.",
    href: "/dashboard/projects",
    cta: "Invite Team",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-2 lg:row-span-1",
  },
  {
    Icon: Shield,
    name: "FuSa Compliance",
    description: "Built-in templates and checks to ensure your projects meet ISO 26262 and other safety standards.",
    href: "/dashboard/help",
    cta: "Learn Standards",
    background: <div className="absolute -right-20 -top-20 opacity-60" />,
    className: "lg:col-span-3 lg:row-span-1",
  },
];

const reviews = [
  {
    name: "Jack",
    username: "@jack",
    body: "I've never seen anything like this before. It's amazing. I love it.",
    img: "https://avatar.vercel.sh/jack",
  },
  {
    name: "Jill",
    username: "@jill",
    body: "I don't know what to say. I'm speechless. This is amazing.",
    img: "https://avatar.vercel.sh/jill",
  },
  {
    name: "John",
    username: "@john",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/john",
  },
  {
    name: "Jane",
    username: "@jane",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/jane",
  },
  {
    name: "Jenny",
    username: "@jenny",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/jenny",
  },
  {
    name: "James",
    username: "@james",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/james",
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
        "relative w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
        // light styles
        "border-gray-950/10 bg-gray-950/1 hover:bg-gray-950/5",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium dark:text-white">
            {name}
          </figcaption>
          <p className="text-xs font-medium dark:text-white/40">{username}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm">{body}</blockquote>
    </figure>
  );
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden bg-white">
      {/* Background Elements */}
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className={cn(
          "[mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)] opacity-50"
        )}
      />
      <Particles
        className="absolute inset-0 z-0"
        quantity={100}
        ease={80}
        color="#000000"
        refresh
      />

      {/* Navbar */}
      <header className="flex h-20 items-center justify-between border-b px-6 lg:px-12 bg-white/80 backdrop-blur-md z-50 sticky top-0">
        <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-xl blur-sm opacity-25 group-hover:opacity-50 transition-opacity duration-300" />
              <div className="relative w-10 h-10 bg-linear-to-br from-blue-600 via-blue-700 to-purple-700 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg border border-white/20">
                <span>P</span>
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-tighter text-gray-900 bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-600">
                Pluto
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/80 mt-0.5">
                Design
              </span>
            </div>
        </div>
        <nav className="flex gap-6 items-center">
          <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
            Features
          </Link>
          <Link href="#testimonials" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
            Testimonials
          </Link>
          <SignedOut>
            <Button variant="ghost" className="text-gray-700 hover:text-blue-600" asChild>
              <Link href="/sign-in">Login</Link>
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6" asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button variant="ghost" className="text-gray-700 hover:text-blue-600" asChild>
              <Link href="/dashboard/process">Process</Link>
            </Button>
            <UserButton />
          </SignedIn>
        </nav>
      </header>

      <main className="flex-1 z-10">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-6 lg:px-12 flex flex-col items-center text-center">
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 max-w-4xl">
            Streamline Your <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
              FuSa Processes
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
            The all-in-one platform for Functional Safety management. Design processes, collaborate with your team, and ensure compliance with ISO 26262 effortlessly.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <SignedOut>
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 h-12 text-lg shadow-lg hover:shadow-xl transition-all" asChild>
                <Link href="/sign-up">
                  Start for Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 h-12 text-lg shadow-lg hover:shadow-xl transition-all" asChild>
                <Link href="/dashboard/process">
                  Go to Process <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </SignedIn>
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-12 text-lg border-gray-300 hover:bg-gray-50" asChild>
              <Link href="#features">
                View Demo
              </Link>
            </Button>
          </div>

          {/* Hero Image / Dashboard Preview */}
          <div className="mt-20 relative w-full max-w-5xl mx-auto rounded-xl border bg-white/50 shadow-2xl overflow-hidden backdrop-blur-sm p-2">
             <div className="rounded-lg overflow-hidden border bg-gray-50 aspect-[16/9] flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 z-0"></div>
                {/* Placeholder for dashboard screenshot */}
                {/* <div className="z-10 text-center">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-lg mx-auto mb-4 flex items-center justify-center">
                        <Zap className="w-10 h-10 text-yellow-500" />
                    </div>
                    <p className="text-gray-500 font-medium">Interactive Dashboard Preview</p>
                </div> */}
                <img src={"/D-D.png"} alt="Dashboard Preview" className="w-full h-full object-cover z-10" />
             </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 lg:px-12 bg-gray-50/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need to succeed</h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Powerful features designed to help you manage complex safety lifecycles with ease and precision.
                </p>
            </div>
            
            <BentoGrid className="lg:grid-rows-2">
              {features.map((feature) => (
                <BentoCard key={feature.name} {...feature} />
              ))}
            </BentoGrid>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-24 px-6 lg:px-12 overflow-hidden">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900">Trusted by Safety Experts</h2>
            </div>
            <div className="relative flex h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-lg">
                <Marquee pauseOnHover className="[--duration:20s]">
                    {firstRow.map((review) => (
                    <ReviewCard key={review.username} {...review} />
                    ))}
                </Marquee>
                <Marquee reverse pauseOnHover className="[--duration:20s]">
                    {secondRow.map((review) => (
                    <ReviewCard key={review.username} {...review} />
                    ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white dark:from-background"></div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white dark:from-background"></div>
            </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 lg:px-12 bg-gray-900 text-white relative overflow-hidden">
            <Particles
                className="absolute inset-0 z-0 opacity-30"
                quantity={50}
                color="#ffffff"
                refresh
            />
            <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl font-bold mb-6">Ready to transform your workflow?</h2>
                <p className="text-xl text-gray-300 mb-10">
                    Join thousands of engineers who trust Pluto for their Functional Safety management.
                </p>
                <SignedOut>
                    <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 rounded-full px-8 h-12 text-lg font-semibold" asChild>
                        <Link href="/sign-up">
                            Get Started Now
                        </Link>
                    </Button>
                </SignedOut>
                <SignedIn>
                    <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 rounded-full px-8 h-12 text-lg font-semibold" asChild>
                        <Link href="/dashboard/process">
                            Go to Process
                        </Link>
                    </Button>
                </SignedIn>
            </div>
        </section>
      </main>

      <footer className="py-12 px-6 lg:px-12 border-t bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">P</div>
                <span className="font-bold text-gray-900">Pluto</span>
            </div>
            <div className="flex gap-8 text-sm text-gray-500">
                <Link href="#" className="hover:text-gray-900">Privacy Policy</Link>
                <Link href="#" className="hover:text-gray-900">Terms of Service</Link>
                <Link href="#" className="hover:text-gray-900">Contact</Link>
            </div>
            <div className="text-sm text-gray-400">
                © 2025 Pluto Inc. All rights reserved.
            </div>
        </div>
      </footer>
    </div>
  )
}
