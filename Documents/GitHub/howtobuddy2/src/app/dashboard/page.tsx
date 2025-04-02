import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DashboardPage() {
  return (
    <div className="container py-6">
      <div className="flex flex-col space-y-4">
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your tutorials and credits.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Total Tutorials</h3>
          <p className="mt-2 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Processing</h3>
          <p className="mt-2 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Completed</h3>
          <p className="mt-2 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Credits Left</h3>
          <p className="mt-2 text-2xl font-bold">10</p>
        </div>
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-semibold">Add New Tutorial</h2>
        <form className="mt-4 flex gap-4">
          <Input
            type="url"
            placeholder="Enter YouTube URL"
            className="flex-1"
          />
          <Button type="submit">
            Process
          </Button>
        </form>
      </div>
    </div>
  )
} 