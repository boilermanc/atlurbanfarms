import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GiftCardsPage: React.FC = () => {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch Gift Up site ID from config_settings
  useEffect(() => {
    async function fetchSiteId() {
      try {
        const { data, error: fetchError } = await supabase
          .from('config_settings')
          .select('value')
          .eq('category', 'giftup')
          .eq('key', 'site_id')
          .maybeSingle();

        if (fetchError) throw fetchError;

        // value is jsonb — may be a string, may need unwrapping
        let id = data?.value ?? '';
        if (typeof id === 'string') {
          // Strip double-encoding: "\"abc\"" → "abc"
          if (id.startsWith('"') && id.endsWith('"')) {
            try { id = JSON.parse(id); } catch { /* keep as-is */ }
          }
        }

        setSiteId(id || '');
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchSiteId();
  }, []);

  // Inject the Gift Up widget script when siteId is available
  useEffect(() => {
    if (!siteId) return;

    // Remove any previous instance to avoid duplicates on re-render
    const existing = document.getElementById('giftup-script');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'giftup-script';
    script.src = 'https://cdn.giftup.app/dist/gift-up.js';
    script.type = 'text/javascript';
    script.async = true;
    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      const s = document.getElementById('giftup-script');
      if (s) s.remove();
    };
  }, [siteId]);

  return (
    <section className="py-16 px-4 md:px-8 min-h-screen bg-white">
      <div className="max-w-[900px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 tracking-tight mb-4">
            Gift Cards
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Give the gift of fresh food. Gift cards can be used for any order and are delivered instantly by email.
          </p>
        </div>

        {/* Widget Area */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (error || !siteId) && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Gift cards are temporarily unavailable</h2>
            <p className="text-gray-500">Please check back soon.</p>
          </div>
        )}

        {!loading && siteId && !error && (
          <div
            className="giftup-checkout-root"
            data-site-id={siteId}
            style={{ minHeight: 500 }}
          />
        )}
      </div>
    </section>
  );
};

export default GiftCardsPage;
