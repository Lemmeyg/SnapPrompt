import * as React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold">{siteConfig.name}</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/dashboard"
                className="transition-colors hover:text-foreground/80 text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/tutorials"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                My Tutorials
              </Link>
              <Link
                href="/dashboard/settings"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <Button variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
} 