import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';
import { usePageContent } from '../src/hooks/useSiteContent';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: 'workshop' | 'open_hours' | 'farm_event' | 'shipping';
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  map_url: string | null;
  registration_link: string | null;
  max_attendees: number | null;
}

interface CalendarPageProps {
  onBack: () => void;
  initialFilter?: string;
}

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  workshop: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  open_hours: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  farm_event: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  shipping: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

interface BrandingSettings {
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_youtube: string;
  social_tiktok: string;
  secondary_brand_color: string;
}

const EVENT_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  open_hours: 'Open Hours',
  farm_event: 'Farm Event',
  shipping: 'Shipping Day',
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ShippingConfig {
  shipping_days: number[]; // 0=Sun, 1=Mon, 2=Tue, etc.
}

const CalendarPage: React.FC<CalendarPageProps> = ({ onBack, initialFilter }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig>({ shipping_days: [] });
  const [blackoutDates, setBlackoutDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter || 'all');
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings>({
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    social_youtube: '',
    social_tiktok: '',
    secondary_brand_color: '#10b981', // Default emerald-500
  });
  const { getSection } = usePageContent('calendar');

  // Get CMS content for header
  const headerContent = getSection('header');

  useEffect(() => {
    fetchEvents();
    fetchBrandingSettings();
    fetchShippingConfig();
  }, []);

  const fetchShippingConfig = async () => {
    try {
      const { data: configData } = await supabase
        .from('shipping_calendar_config')
        .select('shipping_days')
        .single();

      if (configData) {
        setShippingConfig({ shipping_days: configData.shipping_days || [] });
      }
    } catch {
      // Table may not exist yet
    }

    try {
      const { data: blackouts } = await supabase
        .from('shipping_blackout_dates')
        .select('blackout_date');

      if (blackouts) {
        setBlackoutDates(new Set(blackouts.map((b: { blackout_date: string }) => b.blackout_date)));
      }
    } catch {
      // Table may not exist yet
    }
  };

  const fetchBrandingSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('config_settings')
        .select('key, value')
        .eq('category', 'branding');

      if (error) throw error;

      if (data) {
        const brandingData: Record<string, string> = {};
        data.forEach((row: { key: string; value: string }) => {
          brandingData[row.key] = row.value;
        });
        setBrandingSettings({
          social_facebook: brandingData.social_facebook || '',
          social_instagram: brandingData.social_instagram || '',
          social_twitter: brandingData.social_twitter || '',
          social_youtube: brandingData.social_youtube || '',
          social_tiktok: brandingData.social_tiktok || '',
          secondary_brand_color: brandingData.secondary_brand_color || '#10b981',
        });
      }
    } catch (err) {
      console.error('Error fetching branding settings:', err);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('start_date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date | null; dateStr: string | null }[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, dateStr: null });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({ date, dateStr });
    }

    return days;
  }, [currentMonth]);

  // Generate synthetic shipping day events for the visible month
  const shippingEvents = useMemo(() => {
    if (shippingConfig.shipping_days.length === 0) return [];

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const result: Event[] = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0=Sun
      const dateStr = d.toISOString().split('T')[0];

      if (shippingConfig.shipping_days.includes(dayOfWeek) && !blackoutDates.has(dateStr)) {
        result.push({
          id: `shipping-${dateStr}`,
          title: 'Shipping Day',
          description: 'Orders are shipped out today',
          event_type: 'shipping',
          start_date: dateStr,
          end_date: null,
          start_time: null,
          end_time: null,
          location: null,
          map_url: null,
          registration_link: null,
          max_attendees: null,
        });
      }
    }
    return result;
  }, [currentMonth, shippingConfig.shipping_days, blackoutDates]);

  const getEventsForDate = (dateStr: string): Event[] => {
    const allEvents = [...events, ...shippingEvents];
    return allEvents.filter(event => {
      if (activeFilter !== 'all' && event.event_type !== activeFilter) return false;
      const eventStart = event.start_date;
      const eventEnd = event.end_date || event.start_date;
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return [...events, ...shippingEvents]
      .filter(e => e.start_date >= today && (activeFilter === 'all' || e.event_type === activeFilter))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);
  }, [events, shippingEvents, activeFilter]);

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDateRange = (startDate: string, endDate: string | null) => {
    const start = new Date(startDate + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    if (!endDate || startDate === endDate) {
      return start.toLocaleDateString('en-US', options);
    }
    const end = new Date(endDate + 'T00:00:00');
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-site pt-40 pb-20">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-site pt-40 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
            {headerContent.tagline || "What's Happening"}
          </span>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-4">
            {headerContent.headline || 'Events Calendar'}
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {headerContent.description || 'Workshops, farm visits, shipping days, and more. Join us for hands-on learning and community growing!'}
          </p>
        </motion.div>

        {/* Filter Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <button
            onClick={() => setActiveFilter('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
              activeFilter === 'all'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-gray-100 text-gray-400 border-transparent'
            }`}
          >
            All Events
          </button>
          {Object.entries(EVENT_LABELS).map(([type, label]) => {
            const isActive = activeFilter === type;
            const colors = EVENT_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
                  isActive
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-gray-100 text-gray-400 border-transparent'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? colors.dot : 'bg-gray-300'}`} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
            >
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <h2 className="text-xl font-bold text-gray-900">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="p-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day.date || !day.dateStr) {
                    return <div key={`empty-${index}`} className="p-2 min-h-[80px]"></div>;
                  }

                  const dayEvents = getEventsForDate(day.dateStr);
                  const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                  const isSelected = day.dateStr === selectedDate;
                  const isPast = day.dateStr < new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`p-2 min-h-[80px] rounded-xl text-left transition-all hover:bg-gray-50 ${
                        isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''
                      } ${isPast ? 'opacity-50' : ''}`}
                    >
                      <span className={`text-sm font-semibold ${
                        isToday
                          ? 'w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center'
                          : 'text-gray-700'
                      }`}>
                        {day.date.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate ${EVENT_COLORS[event.event_type].bg} ${EVENT_COLORS[event.event_type].text}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 pl-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Date Details */}
            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-gray-400 text-sm">No events scheduled</p>
                ) : (
                  <div className="space-y-4">
                    {selectedDateEvents.map(event => (
                      <div
                        key={event.id}
                        className={`p-4 rounded-2xl ${EVENT_COLORS[event.event_type].bg} border ${EVENT_COLORS[event.event_type].border}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-3 h-3 rounded-full mt-1 ${EVENT_COLORS[event.event_type].dot}`} />
                          <div className="flex-1">
                            <span className={`text-xs font-bold uppercase tracking-wide ${EVENT_COLORS[event.event_type].text}`}>
                              {EVENT_LABELS[event.event_type]}
                            </span>
                            <h4 className="font-bold text-gray-900 mt-1">{event.title}</h4>
                            {event.description && (
                              <div
                                className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none [&_a]:text-emerald-600 [&_a]:underline"
                                dangerouslySetInnerHTML={{ __html: event.description }}
                              />
                            )}
                            {(event.start_time || event.location) && (
                              <div className="mt-3 space-y-1">
                                {event.start_time && (
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"/>
                                      <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    {formatTime(event.start_time)}
                                    {event.end_time && ` - ${formatTime(event.end_time)}`}
                                  </div>
                                )}
                                {event.location && (
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                      <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {event.map_url ? (
                                      <a
                                        href={event.map_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 underline"
                                      >
                                        {event.location}
                                      </a>
                                    ) : (
                                      event.location
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {event.registration_link && (
                              <a
                                href={event.registration_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
                              >
                                Register
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Upcoming Events */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Events</h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-400 text-sm">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedDate(event.start_date)}
                      className="w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${EVENT_COLORS[event.event_type].dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{event.title}</p>
                          <p className="text-sm text-gray-400">
                            {formatDateRange(event.start_date, event.end_date)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Legend Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl shadow-lg p-6 text-white"
              style={{ backgroundColor: brandingSettings.secondary_brand_color }}
            >
              <h3 className="font-bold mb-3">Join Us!</h3>
              <p className="text-sm text-white/80 mb-4">
                Follow us on social media for event updates.
              </p>
              <div className="flex gap-3">
                {brandingSettings.social_facebook && (
                  <a
                    href={brandingSettings.social_facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    aria-label="Facebook"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                    </svg>
                  </a>
                )}
                {brandingSettings.social_instagram && (
                  <a
                    href={brandingSettings.social_instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    aria-label="Instagram"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                    </svg>
                  </a>
                )}
                {brandingSettings.social_twitter && (
                  <a
                    href={brandingSettings.social_twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    aria-label="Twitter"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
                    </svg>
                  </a>
                )}
                {brandingSettings.social_tiktok && (
                  <a
                    href={brandingSettings.social_tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    aria-label="TikTok"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
                    </svg>
                  </a>
                )}
                {brandingSettings.social_youtube && (
                  <a
                    href={brandingSettings.social_youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    aria-label="YouTube"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                      <path d="m10 15 5-3-5-3z"/>
                    </svg>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
