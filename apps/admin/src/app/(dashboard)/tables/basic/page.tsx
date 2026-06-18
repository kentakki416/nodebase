import { Metadata } from "next"
import React from "react"

import BasicTableOne from "@/components/features/example/BasicTableOne"
import ComponentCard from "@/components/layout/ComponentCard"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

export const metadata: Metadata = {
  title: "Next.js Basic Table | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Basic Table  page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
}

export default function BasicTables() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Basic Table" />
      <div className="space-y-6">
        <ComponentCard title="Basic Table 1">
          <BasicTableOne />
        </ComponentCard>
      </div>
    </div>
  )
}
