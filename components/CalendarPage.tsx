import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';

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
  max_attendees: number | null;
}

interface CalendarPageProps {
  onBack: () => void;
}

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  workshop: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  open_hours: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  farm_event: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  shipping: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const EVENT_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  open_hours: 'Open Hours',
  farm_event: 'Farm Event',
  shipping: 'Shipping Day',
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarPage: React.FC<CalendarPageProps> = ({ onBack }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['workshop', 'open_hours', 'farm_event', 'shipping']);

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const getEventsForDate = (dateStr: string): Event[] => {
    return events.filter(event => {
      if (!activeFilters.includes(event.event_type)) return false;
      const eventStart = event.start_date;
      const eventEnd = event.end_date || event.start_date;
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events
      .filter(e => e.start_date >= today && activeFilters.includes(e.event_type))
      .slice(0, 5);
  }, [events, activeFilters]);

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

  const toggleFilter = (eventType: string) => {
    setActiveFilters(prev =>
      prev.includes(eventType)
        ? prev.filter(f => f !== eventType)
        : [...prev, eventType]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
            What's Happening
          </span>
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-4">
            Events Calendar
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Workshops, farm visits, shipping days, and more. Join us for hands-on learning and community growing!
          </p>
        </motion.div>

        {/* Filter Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {Object.entries(EVENT_LABELS).map(([type, label]) => {
            const isActive = activeFilters.includes(type);
            const colors = EVENT_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.text} ${colors.border} border-2`
                    : 'bg-gray-100 text-gray-400 border-2 border-transparent'
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
                              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
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
                                    {event.location}
                                  </div>
                                )}
                              </div>
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
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl shadow-lg p-6 text-white"
            >
              <h3 className="font-bold mb-3">Join Us!</h3>
              <p className="text-sm text-emerald-100 mb-4">
                Follow us on social media for event updates and growing tips.
              </p>
              <div className="flex gap-3">
                <a
                  href="#"
                  className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                  aria-label="Instagram"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                  </svg>
                </a>
                <a
                  href="#"
                  className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                  aria-label="Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
