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

  return (
    <section className="min-h-screen bg-white pt-28 md:pt-32">
      <div className="max-w-[960px] mx-auto px-4">
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
          <iframe
            src={`https://giftup.app/place-order/${siteId}?platform=hosted&display=inline`}
            title="Gift Cards"
            className="w-full rounded-xl"
            style={{ height: 'calc(100vh - 10rem)', minHeight: 600, border: 'none' }}
            allow="payment"
          />
        )}
      </div>
    </section>
  );
};

export default GiftCardsPage;
