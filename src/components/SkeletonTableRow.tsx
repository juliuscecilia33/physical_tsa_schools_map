"use client";

/**
 * Skeleton loading row for CRM facility table
 * Matches the structure of FacilityTable rows with animated shimmer effect
 */
export default function SkeletonTableRow() {
  return (
    <tr className="hover:bg-slate-50/60 transition-colors animate-pulse">
      {/* Facility column */}
      <td className="px-5 py-4 align-top min-w-[200px]">
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-100 rounded w-full"></div>
        </div>
      </td>

      {/* Contact Info column */}
      <td className="px-4 py-3 align-top min-w-[150px]">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded w-24"></div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded w-32"></div>
          </div>
        </div>
      </td>

      {/* Sports column */}
      <td className="px-4 py-3 align-top min-w-[180px]">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 bg-slate-200 rounded w-16"></div>
          <div className="h-5 bg-slate-200 rounded w-20"></div>
          <div className="h-5 bg-slate-200 rounded w-14"></div>
        </div>
      </td>

      {/* Tags column */}
      <td className="px-4 py-3 align-top min-w-[180px]">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 bg-slate-200 rounded w-20"></div>
          <div className="h-5 bg-slate-200 rounded w-24"></div>
        </div>
      </td>

      {/* Metrics column */}
      <td className="px-5 py-4 align-top text-right min-w-[120px]">
        <div className="flex flex-col items-end gap-1.5">
          <div className="h-4 bg-slate-200 rounded w-12"></div>
          <div className="h-3 bg-slate-200 rounded w-16"></div>
          <div className="h-3 bg-slate-200 rounded w-14"></div>
        </div>
      </td>

      {/* Actions column */}
      <td className="px-5 py-4 align-middle text-right">
        <div className="h-8 bg-slate-200 rounded-lg w-28 ml-auto"></div>
      </td>
    </tr>
  );
}

/**
 * Renders multiple skeleton rows for loading state
 */
export function SkeletonTableRows({ count = 10 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonTableRow key={`skeleton-${index}`} />
      ))}
    </>
  );
}
