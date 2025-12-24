import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { DotPattern } from "@/components/magicui/dot-pattern"
import { cn } from "@/lib/utils"
import { Marquee } from "@/components/magicui/marquee"

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
    <div className="flex min-h-screen flex-col relative overflow-hidden">
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className={cn(
          "[mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)] "
        )}
      />
      <header className="flex h-16 items-center justify-between border-b px-6 lg:px-12 bg-white/50 backdrop-blur-sm z-10">
        <div className="text-2xl font-bold">Pluto</div>
        <nav className="flex gap-4">
          <Link href="/sign-in" className="text-sm font-medium hover:underline">
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Get Started
          </Link>
        </nav>
      </header>
      <main className="flex-1 z-10">
        <section className="flex flex-col items-center justify-center gap-6 py-24 text-center lg:py-32 relative">
           <div className="z-10 flex flex-col items-center gap-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Manage your projects with <span className="text-blue-600">Pluto</span>
            </h1>
            <p className="max-w-150 text-lg text-gray-500">
              Streamline your workflow, track tasks, and collaborate with your team in one place.
            </p>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-md bg-black px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12">
           <div className="relative flex h-125 w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background md:shadow-xl">
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
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-white dark:from-background"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-white dark:from-background"></div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-sm text-gray-500 bg-white/50 backdrop-blur-sm z-10">
        © {new Date().getFullYear()} Pluto. All rights reserved.
      </footer>
    </div>
  )
}
