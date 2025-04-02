import * as React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 text-center sm:px-20">
        <h1 className="text-5xl font-bold sm:text-6xl">
          Welcome to{" "}
          <span className="text-primary">
            {siteConfig.name}
          </span>
        </h1>
        <p className="mt-4 text-xl sm:text-2xl">
          {siteConfig.description}
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/auth/login"
            className="rounded-lg bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-input bg-background px-6 py-3 text-lg font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Learn More
          </Link>
        </div>
      </main>
    </div>
  )
} 