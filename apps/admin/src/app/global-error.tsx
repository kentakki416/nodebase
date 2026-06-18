"use client"

import Image from "next/image"
import Link from "next/link"

import GridShape from "@/components/layout/GridShape"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
          <GridShape />
          <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
            <h1 className="mb-8 font-bold text-gray-800 text-title-md dark:text-white/90 xl:text-title-2xl">
              ERROR
            </h1>

            <Image
              alt="Error"
              className="dark:hidden"
              height={152}
              src="/images/error/404.svg"
              width={472}
            />
            <Image
              alt="Error"
              className="hidden dark:block"
              height={152}
              src="/images/error/404-dark.svg"
              width={472}
            />

            <p className="mt-10 mb-6 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
              Something went wrong!
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200"
                onClick={() => reset()}
                type="button"
              >
                Try Again
              </button>
              <Link
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200"
                href="/"
              >
                Back to Home Page
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
