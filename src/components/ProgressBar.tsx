interface ProgressBarProps {
  progress: number;
  loadedCount: number;
  totalCount: number | null;
}

export default function ProgressBar({ progress, loadedCount, totalCount }: ProgressBarProps) {
  const sportsEmojis = ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥏'];

  return (
    <div className="w-full max-w-md px-4 sm:px-6">
      {/* TSA Logo */}
      <div className="flex justify-center mb-6">
        <img
          src="/assets/TSA.png"
          alt="TSA Logo"
          className="h-16 w-auto opacity-90"
          style={{
            animation: 'fadeIn 0.8s ease-in-out',
          }}
        />
      </div>

      {/* Bouncing Sports Emojis */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-4">
        {sportsEmojis.map((emoji, index) => (
          <span
            key={index}
            className="text-2xl sm:text-3xl"
            style={{
              display: 'inline-block',
              animation: 'bounce 1.5s ease-in-out infinite',
              animationDelay: `${index * 0.1}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        @keyframes indeterminate {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(333%);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 0.9;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="mb-2 flex justify-between items-center text-xs sm:text-sm text-gray-600">
        <span className="truncate mr-2">
          {loadedCount === 0 ? 'Connecting to database...' : 'Loading facilities...'}
        </span>
        <span className="font-semibold whitespace-nowrap">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-[#E8E9EB] rounded-full h-3 sm:h-4 overflow-hidden shadow-inner">
        {loadedCount === 0 ? (
          <div
            className="bg-[#004aad] h-full rounded-full opacity-70"
            style={{
              width: '30%',
              animation: 'indeterminate 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            className="bg-[#004aad] h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        )}
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
