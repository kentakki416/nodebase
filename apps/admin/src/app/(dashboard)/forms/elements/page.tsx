import { Metadata } from "next"
import React from "react"

import CheckboxComponents from "@/components/features/example/form-elements/CheckboxComponents"
import DefaultInputs from "@/components/features/example/form-elements/DefaultInputs"
import DropzoneComponent from "@/components/features/example/form-elements/DropZone"
import FileInputExample from "@/components/features/example/form-elements/FileInputExample"
import InputGroup from "@/components/features/example/form-elements/InputGroup"
import InputStates from "@/components/features/example/form-elements/InputStates"
import RadioButtons from "@/components/features/example/form-elements/RadioButtons"
import SelectInputs from "@/components/features/example/form-elements/SelectInputs"
import TextAreaInput from "@/components/features/example/form-elements/TextAreaInput"
import ToggleSwitch from "@/components/features/example/form-elements/ToggleSwitch"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

export const metadata: Metadata = {
  title: "Next.js Form Elements | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Form Elements page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
}

export default function FormElements() {
  return (
    <div>
      <PageBreadcrumb pageTitle="From Elements" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <DefaultInputs />
          <SelectInputs />
          <TextAreaInput />
          <InputStates />
        </div>
        <div className="space-y-6">
          <InputGroup />
          <FileInputExample />
          <CheckboxComponents />
          <RadioButtons />
          <ToggleSwitch />
          <DropzoneComponent />
        </div>
      </div>
    </div>
  )
}
