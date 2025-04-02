import * as React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site"

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to sign in to your account
          </p>
        </div>
        <div className="grid gap-6">
          {/* Auth form will be added here */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              className="inline-flex items-center justify-center rounded-lg border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              GitHub
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Google
            </button>
          </div>
        </div>
        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link
            href="/auth/register"
            className="hover:text-brand underline underline-offset-4"
          >
            Don&apos;t have an account? Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
} 