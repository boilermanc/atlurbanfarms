import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  useTracking,
  TrackingEvent,
  STATUS_LABELS,
  getStatusColor,
  formatTrackingDate,
  getCarrierName
} from '../hooks/useTracking';

interface TrackingPageProps {
  initialTrackingNumber?: string;
  initialCarrierCode?: string;
  onBack?: () => void;
  onNavigate?: (view: string) => void;
}

const TrackingPage: React.FC<TrackingPageProps> = ({
  initialTrackingNumber,
  initialCarrierCode,
  onBack,
  onNavigate
}) => {
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber || '');
  const [carrierCode, setCarrierCode] = useState(initialCarrierCode || '');
  const [showForm, setShowForm] = useState(!initialTrackingNumber);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    trackingInfo,
    loading,
    error,
    fetchTracking,
    refreshTracking
  } = useTracking(initialTrackingNumber, initialCarrierCode);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh || !trackingInfo) return;

    const interval = setInterval(() => {
      refreshTracking();
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, trackingInfo, refreshTracking]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber && carrierCode) {
      await fetchTracking(trackingNumber, carrierCode);
      setShowForm(false);
    }
  }, [trackingNumber, carrierCode, fetchTracking]);

  const handleNewSearch = () => {
    setShowForm(true);
    setTrackingNumber('');
    setCarrierCode('');
  };

  // Carrier options
  const carriers = [
    { code: 'stamps_com', name: 'USPS' },
    { code: 'ups', name: 'UPS' },
    { code: 'fedex', name: 'FedEx' },
    { code: 'dhl_express', name: 'DHL Express' }
  ];

  return (
    <div className="min-h-screen bg-site">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-heading font-bold text-gray-900">Track Your Package</h1>
          </div>
          {trackingInfo && (
            <div className="flex items-center gap-2">
              <button
                onClick={refreshTracking}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                title="Refresh tracking"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleNewSearch}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Track Another
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
          >
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-emerald-50 rounded-full mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
                Enter Tracking Details
              </h2>
              <p className="text-gray-500">
                Enter your tracking number and select the carrier to see delivery status
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter your tracking number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carrier
                </label>
                <select
                  value={carrierCode}
                  onChange={(e) => setCarrierCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                >
                  <option value="">Select carrier...</option>
                  {carriers.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !trackingNumber || !carrierCode}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Tracking...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Track Package
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-800 mb-1">Unable to Track Package</h3>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={handleNewSearch}
                  className="mt-3 text-sm text-red-700 underline hover:no-underline"
                >
                  Try again with different details
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tracking Results */}
        {trackingInfo && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status Card */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Status Header */}
              <div className={`p-6 ${getStatusColor(trackingInfo.status).bg} border-b ${getStatusColor(trackingInfo.status).border}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${getStatusColor(trackingInfo.status).dot}`}></div>
                    <span className={`text-lg font-bold ${getStatusColor(trackingInfo.status).text}`}>
                      {STATUS_LABELS[trackingInfo.status] || trackingInfo.status_description}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">
                    {getCarrierName(trackingInfo.carrier_code)}
                  </span>
                </div>
                <p className="text-gray-600">{trackingInfo.status_description}</p>
              </div>

              {/* Tracking Details */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">Tracking Number:</span>
                  <span className="font-mono font-bold text-gray-900">{trackingInfo.tracking_number}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(trackingInfo.tracking_number)}
                    className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                    title="Copy tracking number"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  {trackingInfo.estimated_delivery && trackingInfo.status !== 'DE' && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Estimated Delivery</p>
                      <p className="font-medium text-emerald-600">
                        {formatTrackingDate(trackingInfo.estimated_delivery, false)}
                      </p>
                    </div>
                  )}

                  {trackingInfo.actual_delivery && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Delivered</p>
                      <p className="font-medium text-emerald-600">
                        {formatTrackingDate(trackingInfo.actual_delivery)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tracking Timeline */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Tracking History</h3>

              {trackingInfo.events.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                  <div className="space-y-6">
                    {trackingInfo.events.map((event: TrackingEvent, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative pl-10"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}>
                          {index === 0 ? (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>

                        <div>
                          <p className={`font-medium ${index === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                            {event.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                            <span>{formatTrackingDate(event.occurred_at)}</span>
                            {(event.city_locality || event.state_province) && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span>
                                  {[event.city_locality, event.state_province].filter(Boolean).join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No tracking events yet. Check back soon for updates.</p>
                </div>
              )}
            </div>

            {/* Auto-refresh toggle */}
            <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  autoRefresh ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
                Auto-refresh {autoRefresh ? 'on' : 'off'}
              </button>
              <span className="text-gray-400">Updates every 60 seconds</span>
            </div>
          </motion.div>
        )}

        {/* Loading State (initial load) */}
        {loading && !trackingInfo && !showForm && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <svg className="animate-spin w-12 h-12 mx-auto mb-4 text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-500">Loading tracking information...</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Need help? Contact us at <a href="mailto:support@atlurbanfarms.com" className="text-emerald-600 hover:underline">support@atlurbanfarms.com</a></p>
        </div>
      </footer>
    </div>
  );
};

export default TrackingPage;
