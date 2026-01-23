import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import { PickupLocation } from '../../hooks/usePickupLocations';
import { PickupSchedule, formatTime } from '../../hooks/usePickupSchedules';

interface PickupReservationWithOrder {
  id: string;
  order_id: string;
  pickup_date: string;
  pickup_time_start: string;
  pickup_time_end: string;
  status: string;
  order?: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
  };
}

interface CalendarSlot {
  scheduleId: string;
  locationId: string;
  locationName: string;
  locationColor: string;
  startTime: string;
  endTime: string;
  maxOrders: number | null;
  bookedCount: number;
  isRecurring: boolean;
  reservations: PickupReservationWithOrder[];
}

interface ShippingPickupCalendarProps {
  locations: PickupLocation[];
  onAddSchedule: (date: string, locationId?: string) => void;
  onViewOrder: (orderId: string) => void;
}

// Location colors for the calendar
const LOCATION_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-500/20', border: 'border-emerald-500' },
  { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-500/20', border: 'border-blue-500' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-500/20', border: 'border-purple-500' },
  { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-500/20', border: 'border-amber-500' },
  { bg: 'bg-pink-500', text: 'text-pink-500', light: 'bg-pink-500/20', border: 'border-pink-500' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-500/20', border: 'border-cyan-500' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Helper functions for date calculations
const getFirstDayOfMonth = (year: number, month: number): Date => new Date(year, month, 1);
const getLastDayOfMonth = (year: number, month: number): Date => new Date(year, month + 1, 0);
const getDaysInMonth = (year: number, month: number): number => getLastDayOfMonth(year, month).getDate();
const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];

const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const isPastDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
};

const ShippingPickupCalendar: React.FC<ShippingPickupCalendarProps> = ({
  locations,
  onAddSchedule,
  onViewOrder
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [schedules, setSchedules] = useState<PickupSchedule[]>([]);
  const [reservations, setReservations] = useState<PickupReservationWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Assign colors to locations
  const locationColors = useMemo(() => {
    const colors: Record<string, typeof LOCATION_COLORS[0]> = {};
    locations.forEach((loc, idx) => {
      colors[loc.id] = LOCATION_COLORS[idx % LOCATION_COLORS.length];
    });
    return colors;
  }, [locations]);

  // Fetch schedules and reservations for the current month
  const fetchData = useCallback(async () => {
    setLoading(true);

    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const lastDay = getLastDayOfMonth(currentYear, currentMonth);

    // Extend range to show previous/next month days visible in the grid
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    try {
      // Fetch all schedules for active locations
      const locationIds = locations.filter(l => l.is_active).map(l => l.id);

      if (locationIds.length === 0) {
        setSchedules([]);
        setReservations([]);
        setLoading(false);
        return;
      }

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('pickup_schedules')
        .select('*')
        .in('location_id', locationIds)
        .eq('is_active', true);

      if (schedulesError) throw schedulesError;
      setSchedules(schedulesData || []);

      // Fetch reservations for the date range
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('pickup_reservations')
        .select(`
          id,
          order_id,
          location_id,
          schedule_id,
          pickup_date,
          pickup_time_start,
          pickup_time_end,
          status,
          orders (
            id,
            order_number,
            shipping_first_name,
            shipping_last_name,
            guest_email,
            customers (
              first_name,
              last_name,
              email
            )
          )
        `)
        .in('location_id', locationIds)
        .gte('pickup_date', formatDateKey(startDate))
        .lte('pickup_date', formatDateKey(endDate))
        .neq('status', 'cancelled');

      if (reservationsError) throw reservationsError;

      // Transform reservations to include order info
      const transformedReservations: PickupReservationWithOrder[] = (reservationsData || []).map((res: any) => ({
        id: res.id,
        order_id: res.order_id,
        location_id: res.location_id,
        schedule_id: res.schedule_id,
        pickup_date: res.pickup_date,
        pickup_time_start: res.pickup_time_start,
        pickup_time_end: res.pickup_time_end,
        status: res.status,
        order: res.orders ? {
          id: res.orders.id,
          order_number: res.orders.order_number,
          customer_name: res.orders.customers
            ? `${res.orders.customers.first_name || ''} ${res.orders.customers.last_name || ''}`.trim()
            : `${res.orders.shipping_first_name || ''} ${res.orders.shipping_last_name || ''}`.trim(),
          customer_email: res.orders.customers?.email || res.orders.guest_email || ''
        } : undefined
      }));

      setReservations(transformedReservations);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, locations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build calendar data structure
  const calendarData = useMemo(() => {
    const data: Record<string, CalendarSlot[]> = {};

    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    // Iterate through each day in the visible range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = formatDateKey(currentDate);
      const dayOfWeek = currentDate.getDay();
      data[dateKey] = [];

      // Find recurring schedules for this day of week
      const recurringForDay = schedules.filter(
        s => s.schedule_type === 'recurring' && s.day_of_week === dayOfWeek
      );

      // Find one-time schedules for this specific date
      const oneTimeForDay = schedules.filter(
        s => s.schedule_type === 'one_time' && s.specific_date === dateKey
      );

      // Combine and create slots
      [...recurringForDay, ...oneTimeForDay].forEach(schedule => {
        const location = locations.find(l => l.id === schedule.location_id);
        if (!location) return;

        // Count reservations for this slot
        const slotReservations = reservations.filter(
          r => r.pickup_date === dateKey &&
               r.pickup_time_start === schedule.start_time &&
               r.pickup_time_end === schedule.end_time &&
               r.location_id === schedule.location_id
        );

        data[dateKey].push({
          scheduleId: schedule.id,
          locationId: schedule.location_id,
          locationName: location.name,
          locationColor: locationColors[location.id]?.bg || 'bg-gray-500',
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          maxOrders: schedule.max_orders,
          bookedCount: slotReservations.length,
          isRecurring: schedule.schedule_type === 'recurring',
          reservations: slotReservations
        });
      });

      // Sort slots by start time
      data[dateKey].sort((a, b) => a.startTime.localeCompare(b.startTime));

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }, [schedules, reservations, locations, locationColors, currentYear, currentMonth]);

  // Generate calendar grid
  const calendarGrid = useMemo(() => {
    const grid: Date[][] = [];
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);

    // Start from the Sunday before the first day of month
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    let week: Date[] = [];
    const totalDays = 42; // 6 weeks * 7 days

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      week.push(date);

      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }

    return grid;
  }, [currentYear, currentMonth]);

  // Navigation handlers
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(formatDateKey(now));
  };

  // Get slots for selected date
  const selectedDateSlots = selectedDate ? calendarData[selectedDate] || [] : [];

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Mobile agenda view
  if (isMobile) {
    return (
      <MobileAgendaView
        currentYear={currentYear}
        currentMonth={currentMonth}
        calendarData={calendarData}
        locations={locations}
        locationColors={locationColors}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        onAddSchedule={onAddSchedule}
        onViewOrder={onViewOrder}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-white">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Location Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {locations.filter(l => l.is_active).map(location => (
            <div key={location.id} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${locationColors[location.id]?.bg}`}></div>
              <span className="text-xs text-slate-400">{location.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-700">
          {DAY_NAMES.map(day => (
            <div key={day} className="p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        <div className="divide-y divide-slate-700">
          {calendarGrid.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-slate-700">
              {week.map((date) => {
                const dateKey = formatDateKey(date);
                const slots = calendarData[dateKey] || [];
                const isCurrentMonth = date.getMonth() === currentMonth;
                const isToday = isSameDay(date, today);
                const isPast = isPastDate(new Date(date));
                const isSelected = selectedDate === dateKey;
                const hasSlots = slots.length > 0;

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                    className={`min-h-[100px] p-2 text-left transition-colors relative ${
                      isCurrentMonth ? 'bg-slate-800' : 'bg-slate-800/50'
                    } ${isPast && isCurrentMonth ? 'opacity-60' : ''} ${
                      isSelected ? 'ring-2 ring-emerald-500 ring-inset' : ''
                    } ${hasSlots ? 'hover:bg-slate-700/50 cursor-pointer' : ''}`}
                  >
                    {/* Date number */}
                    <div className={`text-sm font-medium mb-1 ${
                      isToday
                        ? 'w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center'
                        : isCurrentMonth ? 'text-white' : 'text-slate-500'
                    }`}>
                      {date.getDate()}
                    </div>

                    {/* Slot indicators */}
                    {slots.length > 0 && (
                      <div className="space-y-1">
                        {slots.slice(0, 3).map((slot, idx) => (
                          <div
                            key={idx}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                              slot.maxOrders && slot.bookedCount >= slot.maxOrders
                                ? 'bg-red-500/20 text-red-400'
                                : `${locationColors[slot.locationId]?.light} ${locationColors[slot.locationId]?.text}`
                            }`}
                          >
                            {formatTime(slot.startTime)}
                            {slot.maxOrders && (
                              <span className="ml-1 opacity-75">
                                ({slot.bookedCount}/{slot.maxOrders})
                              </span>
                            )}
                          </div>
                        ))}
                        {slots.length > 3 && (
                          <div className="text-[10px] text-slate-400 px-1.5">
                            +{slots.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day Detail Panel */}
      <AnimatePresence>
        {selectedDate && (
          <DayDetailPanel
            date={selectedDate}
            slots={selectedDateSlots}
            locationColors={locationColors}
            onClose={() => setSelectedDate(null)}
            onAddSchedule={onAddSchedule}
            onViewOrder={onViewOrder}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Day Detail Panel Component
interface DayDetailPanelProps {
  date: string;
  slots: CalendarSlot[];
  locationColors: Record<string, typeof LOCATION_COLORS[0]>;
  onClose: () => void;
  onAddSchedule: (date: string, locationId?: string) => void;
  onViewOrder: (orderId: string) => void;
}

const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  date,
  slots,
  locationColors,
  onClose,
  onAddSchedule,
  onViewOrder
}) => {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-slate-700/50 rounded-xl border border-slate-600 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-600 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{formattedDate}</h3>
          <p className="text-sm text-slate-400">
            {slots.length} pickup slot{slots.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddSchedule(date)}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400">No pickup slots scheduled for this day</p>
            <button
              onClick={() => onAddSchedule(date)}
              className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              Add a one-time schedule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {slots.map((slot, idx) => {
              const isFull = slot.maxOrders && slot.bookedCount >= slot.maxOrders;
              const colors = locationColors[slot.locationId];

              return (
                <div
                  key={idx}
                  className={`rounded-xl border ${isFull ? 'border-red-500/30 bg-red-500/5' : 'border-slate-600 bg-slate-800'} overflow-hidden`}
                >
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors?.bg || 'bg-gray-500'}`}></div>
                      <div>
                        <p className="font-medium text-white">{slot.locationName}</p>
                        <p className="text-sm text-slate-400">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          {slot.isRecurring && (
                            <span className="ml-2 text-xs text-slate-500">(Weekly)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {slot.maxOrders ? (
                        <div className={`text-sm font-medium ${isFull ? 'text-red-400' : 'text-slate-300'}`}>
                          {slot.bookedCount} / {slot.maxOrders} booked
                          {isFull && <span className="ml-1 text-red-400">(Full)</span>}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">
                          {slot.bookedCount} booked (unlimited)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reservations list */}
                  {slot.reservations.length > 0 && (
                    <div className="border-t border-slate-700 divide-y divide-slate-700">
                      {slot.reservations.map((res) => (
                        <div
                          key={res.id}
                          className="px-4 py-2 flex items-center justify-between hover:bg-slate-700/50"
                        >
                          <div>
                            <p className="text-sm text-white">{res.order?.customer_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-400">{res.order?.customer_email}</p>
                          </div>
                          <button
                            onClick={() => res.order && onViewOrder(res.order.id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
                          >
                            {res.order?.order_number || 'View Order'}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Mobile Agenda View Component
interface MobileAgendaViewProps {
  currentYear: number;
  currentMonth: number;
  calendarData: Record<string, CalendarSlot[]>;
  locations: PickupLocation[];
  locationColors: Record<string, typeof LOCATION_COLORS[0]>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAddSchedule: (date: string, locationId?: string) => void;
  onViewOrder: (orderId: string) => void;
}

const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
  currentYear,
  currentMonth,
  calendarData,
  locations,
  locationColors,
  onPrevMonth,
  onNextMonth,
  onToday,
  onAddSchedule,
  onViewOrder
}) => {
  const today = new Date();

  // Get all dates with slots for the current month, sorted
  const datesWithSlots = useMemo(() => {
    const result: { date: string; slots: CalendarSlot[] }[] = [];

    Object.entries(calendarData).forEach(([dateKey, slots]) => {
      const date = new Date(dateKey + 'T00:00:00');
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear && slots.length > 0) {
        result.push({ date: dateKey, slots });
      }
    });

    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }, [calendarData, currentMonth, currentYear]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-bold text-white">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h3>
          <button
            onClick={onNextMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* Location Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {locations.filter(l => l.is_active).map(location => (
          <div key={location.id} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${locationColors[location.id]?.bg}`}></div>
            <span className="text-xs text-slate-400">{location.name}</span>
          </div>
        ))}
      </div>

      {/* Agenda List */}
      {datesWithSlots.length === 0 ? (
        <div className="bg-slate-700/30 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-400">No pickup slots this month</p>
        </div>
      ) : (
        <div className="space-y-3">
          {datesWithSlots.map(({ date, slots }) => {
            const dateObj = new Date(date + 'T00:00:00');
            const isToday = isSameDay(dateObj, today);
            const isPast = isPastDate(new Date(dateObj));

            return (
              <div
                key={date}
                className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${isPast ? 'opacity-60' : ''}`}
              >
                <div className={`px-4 py-3 border-b border-slate-700 ${isToday ? 'bg-emerald-600/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">TODAY</span>
                      )}
                      <span className="font-medium text-white">
                        {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">{slots.length} slot{slots.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-700">
                  {slots.map((slot, idx) => {
                    const isFull = slot.maxOrders && slot.bookedCount >= slot.maxOrders;
                    const colors = locationColors[slot.locationId];

                    return (
                      <div key={idx} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors?.bg || 'bg-gray-500'}`}></div>
                            <span className="text-sm text-white">{slot.locationName}</span>
                          </div>
                          <span className={`text-sm ${isFull ? 'text-red-400' : 'text-slate-300'}`}>
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            {slot.maxOrders ? `${slot.bookedCount}/${slot.maxOrders} booked` : `${slot.bookedCount} booked`}
                            {isFull && <span className="ml-1 text-red-400">(Full)</span>}
                          </span>
                          {slot.reservations.length > 0 && (
                            <button
                              onClick={() => slot.reservations[0]?.order && onViewOrder(slot.reservations[0].order.id)}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              View orders
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShippingPickupCalendar;
