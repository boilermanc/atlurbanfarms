import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface ShipmentStats {
  pending: number;
  shipped: number;
  delivered: number;
  total: number;
}

interface RecentShipment {
  id: string;
  order_number: string;
  tracking_number: string | null;
  carrier_code: string | null;
  status: string;
  tracking_status: string | null;
  created_at: string;
  customer_name: string;
}

const ShippingOverviewTab: React.FC = () => {
  const [stats, setStats] = useState<ShipmentStats>({ pending: 0, shipped: 0, delivered: 0, total: 0 });
  const [recentShipments, setRecentShipments] = useState<RecentShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneStats, setZoneStats] = useState({ allowed: 0, conditional: 0, blocked: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch shipment stats - wrapped in try-catch since table might not exist
      try {
        const { data: shipments, error: shipmentsError } = await supabase
          .from('shipments')
          .select('status, tracking_status');

        if (!shipmentsError && shipments) {
          const pending = shipments.filter(s => s.status === 'pending' || s.status === 'label_created').length;
          const shipped = shipments.filter(s => s.tracking_status === 'IT' || s.status === 'shipped').length;
          const delivered = shipments.filter(s => s.tracking_status === 'DE' || s.status === 'delivered').length;

          setStats({
            pending,
            shipped,
            delivered,
            total: shipments.length
          });
        }

        // Fetch recent shipments with order info
        const { data: recent, error: recentError } = await supabase
          .from('shipments')
          .select(`
            id,
            tracking_number,
            carrier_code,
            status,
            tracking_status,
            created_at,
            order_id
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!recentError && recent) {
          // Fetch order details separately for each shipment
          const shipmentsWithOrders = await Promise.all(
            recent.map(async (s: any) => {
              let orderNumber = 'N/A';
              let customerName = 'Customer';

              if (s.order_id) {
                const { data: order } = await supabase
                  .from('orders')
                  .select('order_number, delivery_address')
                  .eq('id', s.order_id)
                  .single();

                if (order) {
                  orderNumber = order.order_number || 'N/A';
                  customerName = order.delivery_address?.name || 'Customer';
                }
              }

              return {
                id: s.id,
                order_number: orderNumber,
                tracking_number: s.tracking_number,
                carrier_code: s.carrier_code,
                status: s.status,
                tracking_status: s.tracking_status,
                created_at: s.created_at,
                customer_name: customerName
              };
            })
          );

          setRecentShipments(shipmentsWithOrders);
        }
      } catch (shipmentError) {
        // Shipments table might not exist yet - this is fine
        console.log('Shipments table not available:', shipmentError);
      }

      // Fetch zone stats
      const { data: zones } = await supabase
        .from('shipping_zones')
        .select('status');

      if (zones) {
        setZoneStats({
          allowed: zones.filter(z => z.status === 'allowed').length,
          conditional: zones.filter(z => z.status === 'conditional').length,
          blocked: zones.filter(z => z.status === 'blocked').length
        });
      }
    } catch (error) {
      console.error('Error fetching shipping data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCarrierName = (carrierCode: string | null): string => {
    if (!carrierCode) return 'Unknown';
    const carriers: Record<string, string> = {
      'stamps_com': 'USPS',
      'usps': 'USPS',
      'ups': 'UPS',
      'fedex': 'FedEx',
      'dhl_express': 'DHL'
    };
    return carriers[carrierCode.toLowerCase()] || carrierCode.replace(/_/g, ' ').toUpperCase();
  };

  const getStatusBadge = (status: string, trackingStatus: string | null) => {
    if (trackingStatus === 'DE' || status === 'delivered') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (trackingStatus === 'IT' || status === 'shipped') {
      return 'bg-blue-100 text-blue-700';
    }
    if (status === 'label_created') {
      return 'bg-purple-100 text-purple-700';
    }
    return 'bg-amber-100 text-amber-700';
  };

  const getStatusLabel = (status: string, trackingStatus: string | null) => {
    if (trackingStatus === 'DE' || status === 'delivered') return 'Delivered';
    if (trackingStatus === 'IT' || status === 'shipped') return 'In Transit';
    if (status === 'label_created') return 'Label Created';
    return 'Pending';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{stats.pending}</div>
              <div className="text-sm text-slate-500">Pending</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{stats.shipped}</div>
              <div className="text-sm text-slate-500">In Transit</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{stats.delivered}</div>
              <div className="text-sm text-slate-500">Delivered</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-sm text-slate-500">Total Shipments</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Shipments */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Shipments</h3>
          </div>
          {recentShipments.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No shipments yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentShipments.map((shipment) => (
                <div key={shipment.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">#{shipment.order_number}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(shipment.status, shipment.tracking_status)}`}>
                      {getStatusLabel(shipment.status, shipment.tracking_status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{shipment.customer_name}</span>
                    <span className="text-slate-400">{formatDate(shipment.created_at)}</span>
                  </div>
                  {shipment.tracking_number && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-slate-500">{getCarrierName(shipment.carrier_code)}</span>
                      <span className="text-slate-600 font-mono">{shipment.tracking_number}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone Coverage */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Zone Coverage</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Allowed States</span>
              </div>
              <span className="text-xl font-bold text-slate-800">{zoneStats.allowed}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${(zoneStats.allowed / 50) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-600">Conditional States</span>
              </div>
              <span className="text-xl font-bold text-slate-800">{zoneStats.conditional}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full"
                style={{ width: `${(zoneStats.conditional / 50) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-slate-600">Blocked States</span>
              </div>
              <span className="text-xl font-bold text-slate-800">{zoneStats.blocked}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${(zoneStats.blocked / 50) * 100}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 pt-2">
              {50 - zoneStats.blocked} of 50 US states available for shipping
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="/admin#orders"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm text-slate-700 font-medium">View Orders</span>
          </a>
          <a
            href="/admin#integrations"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-sm text-slate-700 font-medium">Integrations</span>
          </a>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm text-slate-700 font-medium">Refresh Stats</span>
          </button>
          <a
            href="https://www.shipengine.com/docs/tracking/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm text-slate-700 font-medium">ShipEngine Docs</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ShippingOverviewTab;
