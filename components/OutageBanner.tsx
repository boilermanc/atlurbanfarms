import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../src/lib/supabase';

/**
 * Detects when Supabase is unreachable and shows a user-facing notice.
 * Runs a lightweight health check on mount and periodically retries.
 * Automatically hides once connectivity is restored.
 */
const OutageBanner: React.FC = () => {
  const [isDown, setIsDown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkHealth = async () => {
      try {
        // Minimal query — just hit the REST API to see if Supabase responds
        const { error } = await supabase
          .from('config_settings')
          .select('key')
          .limit(1)
          .maybeSingle();

        // A Supabase error with no status usually means network failure
        if (error && !error.code) {
          setIsDown(true);
        } else {
          setIsDown(false);
          setDismissed(false); // Reset dismiss if it comes back
        }
      } catch {
        setIsDown(true);
      }
    };

    checkHealth();
    // Re-check every 30 seconds
    interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!isDown || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-amber-500 text-white relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <p className="text-sm font-semibold text-center">
            We're experiencing temporary issues. Some features may be unavailable. Please check back shortly.
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OutageBanner;
