import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import BlackoutDateModal from '../components/BlackoutDateModal';
import OverrideDateModal from '../components/OverrideDateModal';
import { Calendar, Truck, Plus, Pencil, Trash2, X, Repeat } from 'lucide-react';

type TabType = 'events' | 'shipping';

interface RecurrenceRule {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek: number[]; // 0=Sun, 6=Sat
  endType: 'never' | 'after' | 'on_date';
  endAfterOccurrences: number;
  endDate: string | null;
}

const DEFAULT_RECURRENCE: RecurrenceRule = {
  type: 'none',
  interval: 1,
  daysOfWeek: [],
  endType: 'never',
  endAfterOccurrences: 10,
  endDate: null,
};

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
  is_active: boolean;
  recurrence_rule: RecurrenceRule | null;
  parent_event_id: string | null;
}

interface ShippingConfig {
  id?: string;
  shipping_days: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  default_cutoff_time: string;
  cutoff_timezone: string;
  cutoff_grace_minutes: number;
  min_days_to_ship: number;
}

interface BlackoutDate {
  id: string;
  blackout_date: string;
  reason: string;
}

interface OverrideDate {
  id: string;
  override_date: string;
  cutoff_time: string | null;
  reason: string;
}

// Map day index (0=Sun, 6=Sat) to day number used in DB (1=Mon, 5=Fri, etc)
const DAY_INDEX_TO_DB: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_TYPES = [
  { value: 'workshop', label: 'Workshop', color: 'purple' },
  { value: 'open_hours', label: 'Open Hours', color: 'blue' },
  { value: 'farm_event', label: 'Farm Event', color: 'amber' },
  { value: 'shipping', label: 'Shipping Day', color: 'emerald' },
];

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  workshop: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  open_hours: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  farm_event: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  shipping: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
};

const ShippingCalendarPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('events');

  // Events state
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'workshop' as Event['event_type'],
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    max_attendees: '',
    is_active: true,
  });
  const [eventSaving, setEventSaving] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ ...DEFAULT_RECURRENCE });

  // Shipping state
  const [config, setConfig] = useState<ShippingConfig>({
    shipping_days: [1, 2, 3, 4, 5], // Mon-Fri by default
    default_cutoff_time: '12:00',
    cutoff_timezone: 'America/New_York',
    cutoff_grace_minutes: 0,
    min_days_to_ship: 2,
  });
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [overrideDates, setOverrideDates] = useState<OverrideDate[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shippingLoading, setShippingLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchShippingData();
  }, []);

  // Events functions
  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const openEventModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date || '',
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        location: event.location || '',
        max_attendees: event.max_attendees?.toString() || '',
        is_active: event.is_active,
      });
      setRecurrence(event.recurrence_rule || { ...DEFAULT_RECURRENCE });
    } else {
      setEditingEvent(null);
      setEventForm({
        title: '',
        description: '',
        event_type: 'workshop',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        start_time: '10:00',
        end_time: '12:00',
        location: '',
        max_attendees: '',
        is_active: true,
      });
      setRecurrence({ ...DEFAULT_RECURRENCE });
    }
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEditingEvent(null);
  };

  const generateRecurringDates = (startDate: string, rule: RecurrenceRule): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const maxDate = new Date(start);
    maxDate.setMonth(maxDate.getMonth() + 12); // Max 1 year out

    let endDate: Date | null = null;
    let maxOccurrences = 365;

    if (rule.endType === 'on_date' && rule.endDate) {
      endDate = new Date(rule.endDate + 'T00:00:00');
    } else if (rule.endType === 'after') {
      maxOccurrences = rule.endAfterOccurrences;
    }

    const finalEnd = endDate && endDate < maxDate ? endDate : maxDate;
    const current = new Date(start);

    while (current <= finalEnd && dates.length < maxOccurrences) {
      const dateStr = current.toISOString().split('T')[0];

      if (rule.type === 'weekly') {
        if (rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(current.getDay())) {
          dates.push(dateStr);
        }
        // Advance by 1 day; skip weeks based on interval
        const prevWeek = Math.floor((current.getTime() - start.getTime()) / (7 * 86400000));
        current.setDate(current.getDate() + 1);
        const newWeek = Math.floor((current.getTime() - start.getTime()) / (7 * 86400000));
        if (newWeek > prevWeek && (newWeek % rule.interval) !== 0) {
          current.setDate(current.getDate() + (rule.interval - 1) * 7);
        }
      } else if (rule.type === 'daily') {
        dates.push(dateStr);
        current.setDate(current.getDate() + rule.interval);
      } else if (rule.type === 'monthly') {
        dates.push(dateStr);
        current.setMonth(current.getMonth() + rule.interval);
      }
    }

    return dates;
  };

  const handleEventSave = async () => {
    if (!eventForm.title || !eventForm.start_date) return;

    setEventSaving(true);
    try {
      const eventData = {
        title: eventForm.title,
        description: eventForm.description || null,
        event_type: eventForm.event_type,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || null,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        location: eventForm.location || null,
        max_attendees: eventForm.max_attendees ? parseInt(eventForm.max_attendees) : null,
        is_active: eventForm.is_active,
        recurrence_rule: recurrence.type !== 'none' ? recurrence : null,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);
        if (error) throw error;
      } else if (recurrence.type !== 'none') {
        // Create the parent event first
        const { data: parent, error: parentError } = await supabase
          .from('events')
          .insert(eventData)
          .select('id')
          .single();
        if (parentError) throw parentError;

        // Generate recurring instances (skip the first date since parent covers it)
        const dates = generateRecurringDates(eventForm.start_date, recurrence);
        const childDates = dates.slice(1); // Skip first — that's the parent

        if (childDates.length > 0) {
          const children = childDates.map(date => ({
            ...eventData,
            start_date: date,
            end_date: null,
            parent_event_id: parent.id,
            recurrence_rule: null, // Only parent stores the rule
          }));
          const { error: childError } = await supabase.from('events').insert(children);
          if (childError) throw childError;
        }
      } else {
        const { error } = await supabase
          .from('events')
          .insert(eventData);
        if (error) throw error;
      }

      await fetchEvents();
      closeEventModal();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setEventSaving(false);
    }
  };

  const handleEventDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const toggleEventActive = async (event: Event) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: !event.is_active })
        .eq('id', event.id);
      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_active: !e.is_active } : e));
    } catch (error) {
      console.error('Error toggling event:', error);
    }
  };

  // Shipping functions
  const fetchShippingData = async () => {
    setShippingLoading(true);
    try {
      // Fetch config - may not exist yet
      try {
        const { data: configData, error: configError } = await supabase
          .from('shipping_calendar_config')
          .select('*')
          .single();

        if (!configError && configData) {
          setConfig({
            id: configData.id,
            shipping_days: configData.shipping_days || [1, 2, 3, 4, 5],
            default_cutoff_time: configData.default_cutoff_time || '12:00',
            cutoff_timezone: configData.cutoff_timezone || 'America/New_York',
            cutoff_grace_minutes: configData.cutoff_grace_minutes || 0,
            min_days_to_ship: configData.min_days_to_ship || 2,
          });
        }
      } catch {
        // Table doesn't exist yet - use defaults
      }

      // Fetch blackout dates - table may not exist yet
      try {
        const { data: blackouts, error: blackoutsError } = await supabase
          .from('shipping_blackout_dates')
          .select('*')
          .order('blackout_date', { ascending: true });

        if (!blackoutsError && blackouts) {
          setBlackoutDates(blackouts);
        }
      } catch {
        // Table doesn't exist yet
      }

      // Fetch override dates - table may not exist yet
      try {
        const { data: overrides, error: overridesError } = await supabase
          .from('shipping_override_dates')
          .select('*')
          .order('override_date', { ascending: true });

        if (!overridesError && overrides) {
          setOverrideDates(overrides);
        }
      } catch {
        // Table doesn't exist yet
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setShippingLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      if (config.id) {
        await supabase
          .from('shipping_calendar_config')
          .update({
            shipping_days: config.shipping_days,
            default_cutoff_time: config.default_cutoff_time,
            cutoff_timezone: config.cutoff_timezone,
            cutoff_grace_minutes: config.cutoff_grace_minutes,
            min_days_to_ship: config.min_days_to_ship,
          })
          .eq('id', config.id);
      } else {
        const { data } = await supabase
          .from('shipping_calendar_config')
          .insert({
            shipping_days: config.shipping_days,
            default_cutoff_time: config.default_cutoff_time,
            cutoff_timezone: config.cutoff_timezone,
            cutoff_grace_minutes: config.cutoff_grace_minutes,
            min_days_to_ship: config.min_days_to_ship,
          })
          .select()
          .single();

        if (data) {
          setConfig(prev => ({ ...prev, id: data.id }));
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShippingDay = (dayIndex: number) => {
    const dayNum = DAY_INDEX_TO_DB[dayIndex];
    setConfig(prev => {
      const newDays = prev.shipping_days.includes(dayNum)
        ? prev.shipping_days.filter(d => d !== dayNum)
        : [...prev.shipping_days, dayNum].sort((a, b) => a - b);
      return { ...prev, shipping_days: newDays };
    });
  };

  const isShippingDay = (dayIndex: number): boolean => {
    const dayNum = DAY_INDEX_TO_DB[dayIndex];
    return config.shipping_days.includes(dayNum);
  };

  const handleDeleteBlackout = async (id: string) => {
    try {
      await supabase.from('shipping_blackout_dates').delete().eq('id', id);
      setBlackoutDates(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting blackout date:', error);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await supabase.from('shipping_override_dates').delete().eq('id', id);
      setOverrideDates(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting override date:', error);
    }
  };

  const handleBlackoutSave = async (date: string, reason: string) => {
    try {
      const { data } = await supabase
        .from('shipping_blackout_dates')
        .insert({ blackout_date: date, reason })
        .select()
        .single();

      if (data) {
        setBlackoutDates(prev => [...prev, data].sort((a, b) => a.blackout_date.localeCompare(b.blackout_date)));
      }
      setBlackoutModalOpen(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error adding blackout date:', error);
    }
  };

  const handleOverrideSave = async (date: string, cutoffTime: string | null, reason: string) => {
    try {
      const { data } = await supabase
        .from('shipping_override_dates')
        .insert({ override_date: date, cutoff_time: cutoffTime, reason })
        .select()
        .single();

      if (data) {
        setOverrideDates(prev => [...prev, data].sort((a, b) => a.override_date.localeCompare(b.override_date)));
      }
      setOverrideModalOpen(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error adding override date:', error);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    const isBlackout = blackoutDates.some(b => b.blackout_date === dateStr);
    const isOverride = overrideDates.some(o => o.override_date === dateStr);

    if (!isBlackout && !isOverride) {
      setBlackoutModalOpen(true);
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

  const getDateStatus = (dateStr: string, dayOfWeek: number) => {
    const isBlackout = blackoutDates.some(b => b.blackout_date === dateStr);
    const isOverride = overrideDates.some(o => o.override_date === dateStr);
    const isShipping = isShippingDay(dayOfWeek);

    if (isBlackout) return 'blackout';
    if (isOverride) return 'override';
    if (isShipping) return 'shipping';
    return 'none';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const tabs = [
    { id: 'events' as TabType, label: 'Events', icon: <Calendar size={20} /> },
    { id: 'shipping' as TabType, label: 'Shipping Config', icon: <Truck size={20} /> },
  ];

  const renderEventsTab = () => {
    if (eventsLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Add Event Button */}
        <div className="flex justify-between items-center">
          <p className="text-slate-500">Manage workshops, farm events, open hours, and shipping days visible on the public calendar.</p>
          <button
            onClick={() => openEventModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            <Plus size={18} />
            Add Event
          </button>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl">
            <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No events yet. Create your first event!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Event</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-800 flex items-center gap-1.5">
                          {event.title}
                          {(event.recurrence_rule || event.parent_event_id) && (
                            <Repeat size={14} className="text-emerald-500" title="Recurring event" />
                          )}
                        </p>
                        {event.location && (
                          <p className="text-sm text-slate-500">{event.location}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${EVENT_COLORS[event.event_type]?.badge || 'bg-slate-100 text-slate-700'}`}>
                        {EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatDate(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date && (
                        <span> - {formatDate(event.end_date)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {event.start_time ? formatTime(event.start_time) : '-'}
                      {event.end_time && ` - ${formatTime(event.end_time)}`}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleEventActive(event)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          event.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {event.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEventModal(event)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleEventDelete(event.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderShippingTab = () => {
    if (shippingLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Config Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Shipping Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-3">
                Shipping Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day, index) => (
                  <button
                    key={day}
                    onClick={() => handleToggleShippingDay(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isShippingDay(index)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-3">
                Timezone
              </label>
              <div className="px-4 py-2 bg-slate-50 rounded-xl text-slate-600 border border-slate-200">
                {config.cutoff_timezone}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-3">
                Default Cutoff Time
              </label>
              <input
                type="time"
                value={config.default_cutoff_time}
                onChange={(e) => setConfig(prev => ({ ...prev, default_cutoff_time: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-3">
                Minimum Days to Ship
              </label>
              <input
                type="number"
                min="0"
                value={config.min_days_to_ship}
                onChange={(e) => setConfig(prev => ({ ...prev, min_days_to_ship: parseInt(e.target.value) || 0 }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-24"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Calendar View</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <span className="text-slate-800 font-medium min-w-[150px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500"></div>
              <span className="text-sm text-slate-500">Shipping Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm text-slate-500">Blackout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-sm text-slate-500">Override</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-slate-500">
                {day}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              if (!day.date || !day.dateStr) {
                return <div key={`empty-${index}`} className="p-2"></div>;
              }

              const status = getDateStatus(day.dateStr, day.date.getDay());
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];

              return (
                <button
                  key={day.dateStr}
                  onClick={() => handleDateClick(day.dateStr!)}
                  className={`p-2 rounded-lg text-center transition-all hover:ring-2 hover:ring-slate-300 ${
                    status === 'blackout'
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : status === 'override'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : status === 'shipping'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-slate-50 text-slate-500'
                  } ${isToday ? 'ring-2 ring-amber-400' : ''}`}
                >
                  <span className="text-sm font-medium">{day.date.getDate()}</span>
                  {status === 'blackout' && (
                    <div className="text-xs mt-0.5">X</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Blackout Dates List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Blackout Dates</h2>
            <button
              onClick={() => {
                setSelectedDate(null);
                setBlackoutModalOpen(true);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
            >
              Add Blackout
            </button>
          </div>

          {blackoutDates.length === 0 ? (
            <p className="text-slate-500">No blackout dates configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blackoutDates.map(blackout => (
                    <tr key={blackout.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 text-slate-800">{formatDate(blackout.blackout_date)}</td>
                      <td className="py-3 px-4 text-slate-600">{blackout.reason || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteBlackout(blackout.id)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Override Dates List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Override Dates</h2>
            <button
              onClick={() => {
                setSelectedDate(null);
                setOverrideModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              Add Override
            </button>
          </div>

          {overrideDates.length === 0 ? (
            <p className="text-slate-500">No override dates configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Custom Cutoff</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideDates.map(override => (
                    <tr key={override.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 text-slate-800">{formatDate(override.override_date)}</td>
                      <td className="py-3 px-4 text-slate-600">{override.cutoff_time || 'Default'}</td>
                      <td className="py-3 px-4 text-slate-600">{override.reason || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteOverride(override.id)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Events Calendar</h1>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 mb-8">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeCalendarTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'events' ? renderEventsTab() : renderShippingTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Event Modal */}
      <AnimatePresence>
        {eventModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={closeEventModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                  <h2 className="text-xl font-semibold text-slate-800">
                    {editingEvent ? 'Edit Event' : 'Add Event'}
                  </h2>
                  <button
                    onClick={closeEventModal}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Event title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                    <select
                      value={eventForm.event_type}
                      onChange={e => setEventForm(prev => ({ ...prev, event_type: e.target.value as Event['event_type'] }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      rows={3}
                      placeholder="Event description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={eventForm.start_date}
                        onChange={e => setEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={eventForm.end_date}
                        onChange={e => setEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={e => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={e => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={eventForm.location}
                      onChange={e => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Event location"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Attendees</label>
                    <input
                      type="number"
                      value={eventForm.max_attendees}
                      onChange={e => setEventForm(prev => ({ ...prev, max_attendees: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={eventForm.is_active}
                      onChange={e => setEventForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                      Active (visible on public calendar)
                    </label>
                  </div>

                  {/* Recurrence Options */}
                  {!editingEvent && (
                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Repeat size={16} />
                        Recurrence
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Repeat</label>
                        <select
                          value={recurrence.type}
                          onChange={e => setRecurrence(prev => ({ ...prev, type: e.target.value as RecurrenceRule['type'] }))}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          <option value="none">Does not repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      {recurrence.type !== 'none' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Every {recurrence.type === 'daily' ? 'X days' : recurrence.type === 'weekly' ? 'X weeks' : 'X months'}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={recurrence.interval}
                              onChange={e => setRecurrence(prev => ({ ...prev, interval: parseInt(e.target.value) || 1 }))}
                              className="w-24 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>

                          {recurrence.type === 'weekly' && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">On days</label>
                              <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((day, idx) => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => setRecurrence(prev => ({
                                      ...prev,
                                      daysOfWeek: prev.daysOfWeek.includes(idx)
                                        ? prev.daysOfWeek.filter(d => d !== idx)
                                        : [...prev.daysOfWeek, idx].sort((a, b) => a - b),
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                      recurrence.daysOfWeek.includes(idx)
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ends</label>
                            <select
                              value={recurrence.endType}
                              onChange={e => setRecurrence(prev => ({ ...prev, endType: e.target.value as RecurrenceRule['endType'] }))}
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            >
                              <option value="never">Never (up to 1 year)</option>
                              <option value="after">After X occurrences</option>
                              <option value="on_date">On date</option>
                            </select>
                          </div>

                          {recurrence.endType === 'after' && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Number of occurrences</label>
                              <input
                                type="number"
                                min="2"
                                max="365"
                                value={recurrence.endAfterOccurrences}
                                onChange={e => setRecurrence(prev => ({ ...prev, endAfterOccurrences: parseInt(e.target.value) || 10 }))}
                                className="w-24 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              />
                            </div>
                          )}

                          {recurrence.endType === 'on_date' && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                              <input
                                type="date"
                                value={recurrence.endDate || ''}
                                onChange={e => setRecurrence(prev => ({ ...prev, endDate: e.target.value || null }))}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
                  <button
                    onClick={closeEventModal}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEventSave}
                    disabled={eventSaving || !eventForm.title || !eventForm.start_date}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {eventSaving ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BlackoutDateModal
        isOpen={blackoutModalOpen}
        onClose={() => {
          setBlackoutModalOpen(false);
          setSelectedDate(null);
        }}
        onSave={handleBlackoutSave}
        initialDate={selectedDate}
      />

      <OverrideDateModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setSelectedDate(null);
        }}
        onSave={handleOverrideSave}
        initialDate={selectedDate}
      />
    </AdminPageWrapper>
  );
};

export default ShippingCalendarPage;
