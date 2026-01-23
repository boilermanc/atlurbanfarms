import React, { useState, useEffect, useMemo } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import BlackoutDateModal from '../components/BlackoutDateModal';
import OverrideDateModal from '../components/OverrideDateModal';

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

const ShippingCalendarPage: React.FC = () => {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
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
      setLoading(false);
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

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Shipping Calendar</h1>

        {/* Config Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-8">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-8">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-8">
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
