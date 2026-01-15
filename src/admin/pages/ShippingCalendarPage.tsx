import React, { useState, useEffect, useMemo } from 'react';
import AdminPageWrapper from '../components/AdminPageWrapper';
import { supabase } from '../../lib/supabase';
import BlackoutDateModal from '../components/BlackoutDateModal';
import OverrideDateModal from '../components/OverrideDateModal';

interface ShippingConfig {
  id?: string;
  shipping_days: boolean[];
  default_cutoff_time: string;
  timezone: string;
  min_days_to_ship: number;
}

interface BlackoutDate {
  id: string;
  date: string;
  reason: string;
}

interface OverrideDate {
  id: string;
  date: string;
  custom_cutoff_time: string | null;
  reason: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ShippingCalendarPage: React.FC = () => {
  const [config, setConfig] = useState<ShippingConfig>({
    shipping_days: [false, true, true, true, true, true, false],
    default_cutoff_time: '12:00',
    timezone: 'America/New_York',
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
      const { data: configData } = await supabase
        .from('shipping_calendar_config')
        .select('*')
        .single();

      if (configData) {
        setConfig({
          id: configData.id,
          shipping_days: configData.shipping_days || [false, true, true, true, true, true, false],
          default_cutoff_time: configData.default_cutoff_time || '12:00',
          timezone: configData.timezone || 'America/New_York',
          min_days_to_ship: configData.min_days_to_ship || 2,
        });
      }

      const { data: blackouts } = await supabase
        .from('shipping_blackout_dates')
        .select('*')
        .order('date', { ascending: true });

      if (blackouts) {
        setBlackoutDates(blackouts);
      }

      const { data: overrides } = await supabase
        .from('shipping_override_dates')
        .select('*')
        .order('date', { ascending: true });

      if (overrides) {
        setOverrideDates(overrides);
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
            timezone: config.timezone,
            min_days_to_ship: config.min_days_to_ship,
          })
          .eq('id', config.id);
      } else {
        const { data } = await supabase
          .from('shipping_calendar_config')
          .insert({
            shipping_days: config.shipping_days,
            default_cutoff_time: config.default_cutoff_time,
            timezone: config.timezone,
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

  const handleToggleShippingDay = (index: number) => {
    setConfig(prev => ({
      ...prev,
      shipping_days: prev.shipping_days.map((day, i) => (i === index ? !day : day)),
    }));
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
        .insert({ date, reason })
        .select()
        .single();

      if (data) {
        setBlackoutDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      }
      setBlackoutModalOpen(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error adding blackout date:', error);
    }
  };

  const handleOverrideSave = async (date: string, customCutoffTime: string | null, reason: string) => {
    try {
      const { data } = await supabase
        .from('shipping_override_dates')
        .insert({ date, custom_cutoff_time: customCutoffTime, reason })
        .select()
        .single();

      if (data) {
        setOverrideDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      }
      setOverrideModalOpen(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error adding override date:', error);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    const isBlackout = blackoutDates.some(b => b.date === dateStr);
    const isOverride = overrideDates.some(o => o.date === dateStr);

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
    const isBlackout = blackoutDates.some(b => b.date === dateStr);
    const isOverride = overrideDates.some(o => o.date === dateStr);
    const isShippingDay = config.shipping_days[dayOfWeek];

    if (isBlackout) return 'blackout';
    if (isOverride) return 'override';
    if (isShippingDay) return 'shipping';
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
        <h1 className="text-3xl font-bold text-white mb-8">Shipping Calendar</h1>

        {/* Config Card */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">Shipping Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Shipping Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day, index) => (
                  <button
                    key={day}
                    onClick={() => handleToggleShippingDay(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      config.shipping_days[index]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Timezone
              </label>
              <div className="px-4 py-2 bg-slate-700 rounded-lg text-slate-300">
                {config.timezone}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Default Cutoff Time
              </label>
              <input
                type="time"
                value={config.default_cutoff_time}
                onChange={(e) => setConfig(prev => ({ ...prev, default_cutoff_time: e.target.value }))}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Minimum Days to Ship
              </label>
              <input
                type="number"
                min="0"
                value={config.min_days_to_ship}
                onChange={(e) => setConfig(prev => ({ ...prev, min_days_to_ship: parseInt(e.target.value) || 0 }))}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-24"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Calendar View</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <span className="text-white font-medium min-w-[150px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-600"></div>
              <span className="text-sm text-slate-400">Shipping Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-600"></div>
              <span className="text-sm text-slate-400">Blackout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-600"></div>
              <span className="text-sm text-slate-400">Override</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-slate-400">
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
                  className={`p-2 rounded-lg text-center transition-all hover:ring-2 hover:ring-slate-500 ${
                    status === 'blackout'
                      ? 'bg-red-600/20 text-red-400 border border-red-600'
                      : status === 'override'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600'
                      : status === 'shipping'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50'
                      : 'bg-slate-700/50 text-slate-400'
                  } ${isToday ? 'ring-2 ring-yellow-500' : ''}`}
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
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Blackout Dates</h2>
            <button
              onClick={() => {
                setSelectedDate(null);
                setBlackoutModalOpen(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Add Blackout
            </button>
          </div>

          {blackoutDates.length === 0 ? (
            <p className="text-slate-400">No blackout dates configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blackoutDates.map(blackout => (
                    <tr key={blackout.id} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-white">{formatDate(blackout.date)}</td>
                      <td className="py-3 px-4 text-slate-300">{blackout.reason || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteBlackout(blackout.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
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
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Override Dates</h2>
            <button
              onClick={() => {
                setSelectedDate(null);
                setOverrideModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Add Override
            </button>
          </div>

          {overrideDates.length === 0 ? (
            <p className="text-slate-400">No override dates configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Custom Cutoff</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideDates.map(override => (
                    <tr key={override.id} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-white">{formatDate(override.date)}</td>
                      <td className="py-3 px-4 text-slate-300">{override.custom_cutoff_time || 'Default'}</td>
                      <td className="py-3 px-4 text-slate-300">{override.reason || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteOverride(override.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
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
