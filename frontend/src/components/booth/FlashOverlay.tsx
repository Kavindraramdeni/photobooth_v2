'use client';

import { useBoothStore } from '@/lib/store';
import { AnimatePresence, motion } from 'framer-motion';

export function FlashOverlay() {
  const { flashActive } = useBoothStore();

  return (
    <AnimatePresence>
      {flashActive && (
        <motion.div
          key="flash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-0 bg-white z-50 pointer-events-none"
        />
      )}
    </AnimatePresence>
  );
}
