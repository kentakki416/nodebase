import { Outfit } from "next/font/google"

import "./globals.css"
import "flatpickr/dist/flatpickr.css"
import { SidebarProvider } from "@/features/sidebar/sidebar.context"
import { ThemeProvider } from "@/features/theme/theme.context"

const outfit = Outfit({
  subsets: ["latin"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
