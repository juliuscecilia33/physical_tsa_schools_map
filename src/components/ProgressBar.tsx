interface ProgressBarProps {
  progress: number;
  loadedCount: number;
  totalCount: number | null;
}

export default function ProgressBar({ progress, loadedCount, totalCount }: ProgressBarProps) {
  return (
    <div className="w-full max-w-md px-4 sm:px-6">
      <div className="mb-2 flex justify-between items-center text-xs sm:text-sm text-gray-600">
        <span className="truncate mr-2">Loading facilities...</span>
        <span className="font-semibold whitespace-nowrap">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden shadow-inner">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 text-center text-xs sm:text-sm text-gray-500">
        {totalCount !== null ? (
          <span className="block sm:inline">
            {loadedCount.toLocaleString()} / {totalCount.toLocaleString()} facilities loaded
          </span>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </div>
  );
}
