"use client"

import { ReactNode, useEffect, useMemo, useRef, useState } from "react"

import Pagination from "./Pagination"

import { Table, TableBody, TableCell, TableHeader, TableRow } from "./index"

/**
 * テーブルカラム定義
 */
export type Column<T> = {
  /** セルのカスタムクラス名 */
  className?: string
  /** カラムヘッダーに表示するラベル */
  header: string
  /** T のキーを指定して単純にテキスト表示する場合 */
  key?: keyof T
  /** カスタム描画関数。key より優先される */
  render?: (row: T) => ReactNode
}

/**
 * 検索設定
 */
type SearchConfig<T> = {
  /** 検索対象のフィールド（T のキー配列） */
  filterKeys: (keyof T)[]
  /** プレースホルダーテキスト */
  placeholder?: string
}

/**
 * ページネーション設定
 */
type PaginationConfig = {
  /** 1ページあたりの表示件数の選択肢 */
  pageSizeOptions?: number[]
}

/**
 * フィルタ定義
 */
export type FilterConfig<T> = {
  /** フィルタ対象のフィールド */
  key: keyof T
  /** フィルタのラベル */
  label: string
  /** 選択肢 */
  options: { label: string; value: string }[]
}

/**
 * DataTable の Props
 */
type DataTableProps<T> = {
  /** カラム定義 */
  columns: Column<T>[]
  /** テーブルに表示するデータ配列 */
  data: T[]
  /** フィルタ定義。指定するとフィルタアイコンを表示 */
  filters?: FilterConfig<T>[]
  /** 各行のユニークキーを取得する関数 */
  getRowKey: (row: T) => string | number
  /** ページネーション設定。指定するとページネーションを表示 */
  pagination?: PaginationConfig
  /** 検索設定。指定すると検索バーを表示 */
  search?: SearchConfig<T>
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20]

export default function DataTable<T>({
  columns,
  data,
  filters,
  getRowKey,
  pagination,
  search,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(
    pagination?.pageSizeOptions?.[0] ?? DEFAULT_PAGE_SIZE_OPTIONS[0]
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  const hasToolbar = search || pagination || (filters && filters.length > 0)
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length

  /**
   * フィルタパネル外クリックで閉じる
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false)
      }
    }
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isFilterOpen])

  /**
   * フィルタ適用
   */
  const filterAppliedData = useMemo(() => {
    if (!filters) return data
    return data.filter((row) =>
      filters.every((f) => {
        const selected = filterValues[String(f.key)]
        if (!selected) return true
        return String(row[f.key]) === selected
      })
    )
  }, [data, filters, filterValues])

  /**
   * 検索フィルタ
   */
  const filteredData = useMemo(() => {
    if (!search || !searchQuery) return filterAppliedData
    const lower = searchQuery.toLowerCase()
    return filterAppliedData.filter((row) =>
      search.filterKeys.some((key) => {
        const value = row[key]
        return (
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(lower)
        )
      })
    )
  }, [filterAppliedData, search, searchQuery])

  /**
   * ページネーション
   */
  const totalPages = pagination
    ? Math.max(1, Math.ceil(filteredData.length / perPage))
    : 1

  const displayData = useMemo(() => {
    if (!pagination) return filteredData
    const start = (currentPage - 1) * perPage
    return filteredData.slice(start, start + perPage)
  }, [filteredData, pagination, currentPage, perPage])

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handlePerPageChange = (size: number) => {
    setPerPage(size)
    setCurrentPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setFilterValues({})
    setCurrentPage(1)
  }

  const pageSizeOptions =
    pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      {/* ヘッダー: Show entries（左） + 検索バー・フィルタアイコン（右） */}
      {hasToolbar && (
        <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center dark:border-white/5">
          {pagination ? (
            <div className="flex items-center gap-2">
              <span className="text-theme-sm text-gray-600 dark:text-gray-400">
                Show
              </span>
              <select
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-theme-sm text-gray-600 dark:text-gray-400">
                entries
              </span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {search && (
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:w-[250px]"
                  placeholder={search.placeholder ?? "検索..."}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            )}
            {filters && filters.length > 0 && (
              <div className="relative" ref={filterPanelRef}>
                <button
                  className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
                    activeFilterCount > 0
                      ? "border-brand-500 bg-brand-500/10 text-brand-500"
                      : "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* フィルタパネル（ポップオーバー） */}
                {isFilterOpen && (
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        フィルタ
                      </span>
                      {activeFilterCount > 0 && (
                        <button
                          className="text-xs text-brand-500 hover:text-brand-600"
                          onClick={handleFilterReset}
                        >
                          リセット
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {filters.map((f) => (
                        <div key={String(f.key)}>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                            {f.label}
                          </label>
                          <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                            value={filterValues[String(f.key)] ?? ""}
                            onChange={(e) =>
                              handleFilterChange(
                                String(f.key),
                                e.target.value
                              )
                            }
                          >
                            <option value="">すべて</option>
                            {f.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* テーブル */}
      <Table>
        <TableHeader className="border-b border-gray-100 dark:border-white/5">
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={String(col.key ?? col.header)}
                isHeader
                className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
          {displayData.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((col) => (
                <TableCell
                  key={String(col.key ?? col.header)}
                  className={
                    col.className ??
                    "px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400"
                  }
                >
                  {col.render
                    ? col.render(row)
                    : col.key !== null && col.key !== undefined
                      ? String(row[col.key] ?? "")
                      : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* フッター: Showing X to Y of Z（左） + ページネーション（右） */}
      {pagination && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 px-5 py-4 xl:flex-row dark:border-white/5">
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">
            Showing{" "}
            {filteredData.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredData.length)} of{" "}
            {filteredData.length} entries
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
