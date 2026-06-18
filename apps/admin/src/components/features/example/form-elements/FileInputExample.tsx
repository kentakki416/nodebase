"use client"
import React from "react"

import ComponentCard from "@/components/layout/ComponentCard"
import FileInput from "@/components/ui/form/FileInput"
import Label from "@/components/ui/form/Label"

export default function FileInputExample() {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      console.log("Selected file:", file.name)
    }
  }

  return (
    <ComponentCard title="File Input">
      <div>
        <Label>Upload file</Label>
        <FileInput onChange={handleFileChange} className="" />
      </div>
    </ComponentCard>
  )
}
