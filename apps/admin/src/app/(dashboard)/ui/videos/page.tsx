import { Metadata } from "next"
import React from "react"

import VideosExample from "@/components/features/example/VideosExample"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

export const metadata: Metadata = {
  title: "Next.js Videos | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Videos page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
}

export default function VideoPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Videos" />

      <VideosExample />
    </div>
  )
}
