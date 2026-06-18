"use client"
import React, { useState } from "react"

import ComponentCard from "@/components/layout/ComponentCard"
import Label from "@/components/ui/form/Label"
import TextArea from "@/components/ui/form/TextArea"

export default function TextAreaInput() {
  const [message, setMessage] = useState("")
  const [messageTwo, setMessageTwo] = useState("")
  return (
    <ComponentCard title="Textarea input field">
      <div className="space-y-6">
        {/* Default TextArea */}
        <div>
          <Label>Description</Label>
          <TextArea
            value={message}
            onChange={(value) => setMessage(value)}
            rows={6}
          />
        </div>

        {/* Disabled TextArea */}
        <div>
          <Label>Description</Label>
          <TextArea rows={6} disabled />
        </div>

        {/* Error TextArea */}
        <div>
          <Label>Description</Label>
          <TextArea
            rows={6}
            value={messageTwo}
            error
            onChange={(value) => setMessageTwo(value)}
            hint="Please enter a valid message."
          />
        </div>
      </div>
    </ComponentCard>
  )
}
