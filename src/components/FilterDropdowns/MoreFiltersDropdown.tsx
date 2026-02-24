'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface MoreFiltersDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export default function MoreFiltersDropdown({
  isOpen,
  onClose,
  buttonRef,
}: MoreFiltersDropdownProps) {
  if (!isOpen) return null;

  const buttonRect = buttonRef.current?.getBoundingClientRect();

  // Calculate position accounting for any parent scroll
  const dropdownStyle = buttonRect
    ? {
        position: 'fixed' as const,
        top: `${buttonRect.bottom + 8}px`,
        left: `${buttonRect.left}px`,
      }
    : { display: 'none' as const };

  return (
    <>
      {/* Backdrop to close dropdown */}
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
      />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          style={dropdownStyle}
          className="z-30 w-[280px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">More Filters</h3>
            <div className="text-sm text-gray-500 text-center py-8">
              Additional filter options coming soon
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
