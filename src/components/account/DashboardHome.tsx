import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useCombinedOrders, useFavorites } from '../../hooks/useSupabase';
import { ORDER_STATUS_CONFIG, type OrderStatus } from '../../constants/orderStatus';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardHomeProps {
  userId: string;
  customerProfile: any;
  onNavigate: (view: string) => void;
  onTabChange: (tab: string) => void;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  published_at: string | null;
}

interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface SeasonalTip {
  title: string;
  description: string;
  icon: string;
  level?: 'beginner';
}

// ─── Seasonal Tips (Atlanta, Zone 7b/8a) ────────────────────────────────────

const SEASONAL_TIPS: Record<number, { label: string; tips: SeasonalTip[] }> = {
  0: {
    label: 'January in Atlanta',
    tips: [
      { title: 'Plan Your Spring Garden', description: 'Order seeds and sketch out garden beds. Atlanta\'s last frost is typically mid-March.', icon: '📝' },
      { title: 'Start Seeds Indoors', description: 'Get a head start on slow-growers like onions, leeks, and celery under grow lights.', icon: '💡' },
      { title: 'Prep Your Soil', description: 'Add compost to garden beds now so it breaks down before spring planting.', icon: '🪴' },
      { title: 'Easy Indoor Herbs', description: 'Grow basil, cilantro, and chives on a sunny windowsill while you wait for spring.', icon: '🌿', level: 'beginner' },
    ],
  },
  1: {
    label: 'February in Atlanta',
    tips: [
      { title: 'Direct Sow Cool Crops', description: 'Plant peas, spinach, and radishes outdoors — they handle Atlanta\'s late winter cold.', icon: '🥬' },
      { title: 'Start Warm-Season Seeds', description: 'Begin tomato, pepper, and eggplant seeds indoors 6-8 weeks before transplanting.', icon: '🌱' },
      { title: 'Prune Fruit Trees', description: 'Prune while dormant. Atlanta\'s mild winters mean early bud break is coming soon.', icon: '✂️' },
      { title: 'Try Lettuce First', description: 'Lettuce is forgiving, grows fast, and loves cool weather — perfect for beginners.', icon: '🥗', level: 'beginner' },
    ],
  },
  2: {
    label: 'March in Atlanta',
    tips: [
      { title: 'Transplant Cool Crops', description: 'Move broccoli, cabbage, and kale seedlings outdoors. They thrive in spring temps.', icon: '🥦' },
      { title: 'Direct Sow Greens', description: 'Plant lettuce, arugula, and Swiss chard directly in garden beds.', icon: '🥬' },
      { title: 'Amend Clay Soil', description: 'Atlanta\'s red clay benefits from compost and pine bark for better drainage.', icon: '🪴' },
      { title: 'Herb Container Garden', description: 'Start with basil, parsley, and mint in pots — easy wins for new growers.', icon: '🌿', level: 'beginner' },
    ],
  },
  3: {
    label: 'April in Atlanta',
    tips: [
      { title: 'Plant Warm-Season Crops', description: 'After last frost (mid-March to early April), transplant tomatoes, peppers, and squash.', icon: '🍅' },
      { title: 'Mulch Everything', description: 'Apply 2-3 inches of mulch to retain moisture as Atlanta\'s heat builds.', icon: '🌾' },
      { title: 'Set Up Drip Irrigation', description: 'Consistent watering is key. Atlanta summers are hot — automate if you can.', icon: '💧' },
      { title: 'Cherry Tomatoes', description: 'The easiest tomato variety for beginners. Plant in a sunny spot and watch them go!', icon: '🍒', level: 'beginner' },
    ],
  },
  4: {
    label: 'May in Atlanta',
    tips: [
      { title: 'Plant Heat Lovers', description: 'Okra, sweet potatoes, southern peas, and melons thrive in Atlanta\'s warming soil.', icon: '🌶️' },
      { title: 'Watch for Pests', description: 'Aphids and tomato hornworms appear now. Check plants daily and handpick or use neem oil.', icon: '🐛' },
      { title: 'Succession Plant', description: 'Plant new lettuce and bean seeds every 2-3 weeks for continuous harvests.', icon: '📅' },
      { title: 'Start Small', description: 'Focus on 3-4 easy crops rather than everything. Herbs, tomatoes, and peppers are reliable.', icon: '🎯', level: 'beginner' },
    ],
  },
  5: {
    label: 'June in Atlanta',
    tips: [
      { title: 'Water Deeply', description: 'Atlanta heat demands deep watering early morning. Shallow watering encourages weak roots.', icon: '💧' },
      { title: 'Harvest Regularly', description: 'Pick squash, beans, and cucumbers often to encourage continued production.', icon: '🧺' },
      { title: 'Shade Your Lettuce', description: 'Use shade cloth to extend cool-season crops into summer. They bolt in full sun heat.', icon: '☀️' },
      { title: 'Don\'t Overwater', description: 'Wilting in afternoon heat is normal. Check soil moisture before watering — soggy roots kill plants.', icon: '🚿', level: 'beginner' },
    ],
  },
  6: {
    label: 'July in Atlanta',
    tips: [
      { title: 'Maintain & Harvest', description: 'Peak harvest season! Keep picking tomatoes, peppers, squash, and beans.', icon: '🍅' },
      { title: 'Plan Fall Garden', description: 'Start fall brassica seeds indoors now for August transplanting.', icon: '📋' },
      { title: 'Compost Kitchen Scraps', description: 'Build soil for fall planting. Hot compost breaks down quickly in summer heat.', icon: '♻️' },
      { title: 'Enjoy the Harvest', description: 'Your hard work is paying off! Share extras with neighbors and freeze what you can\'t eat.', icon: '🎉', level: 'beginner' },
    ],
  },
  7: {
    label: 'August in Atlanta',
    tips: [
      { title: 'Start Fall Garden', description: 'Transplant broccoli, cauliflower, and kale seedlings. Direct sow beans and squash.', icon: '🥦' },
      { title: 'Plant Cover Crops', description: 'Where summer crops finish, plant crimson clover or cowpeas to rebuild soil.', icon: '🌾' },
      { title: 'Solarize Problem Areas', description: 'Use clear plastic to heat-treat soil and kill pathogens in unused beds.', icon: '☀️' },
      { title: 'Fall Lettuce & Greens', description: 'Perfect time to start another round of easy greens as temps begin to cool.', icon: '🥬', level: 'beginner' },
    ],
  },
  8: {
    label: 'September in Atlanta',
    tips: [
      { title: 'Plant Cool-Season Crops', description: 'Direct sow turnips, radishes, beets, and carrots. Transplant lettuce and spinach.', icon: '🥕' },
      { title: 'Garlic Planning', description: 'Order garlic bulbs now for October planting — Atlanta\'s #1 fall crop.', icon: '🧄' },
      { title: 'Save Seeds', description: 'Let your best tomatoes and peppers ripen fully and save seeds for next year.', icon: '🌻' },
      { title: 'Cool-Season Restart', description: 'Fall is like a second spring in Atlanta. Plant the same easy crops you grew in spring!', icon: '🔄', level: 'beginner' },
    ],
  },
  9: {
    label: 'October in Atlanta',
    tips: [
      { title: 'Plant Garlic', description: 'Plant garlic cloves 2 inches deep. They\'ll overwinter and be ready by late May.', icon: '🧄' },
      { title: 'Extend the Season', description: 'Use row covers and cold frames to protect tender crops from early frost.', icon: '🏕️' },
      { title: 'Harvest Root Crops', description: 'Carrots, beets, and turnips sweeten after a light frost. Don\'t rush the harvest.', icon: '🥕' },
      { title: 'Leaf Mulch', description: 'Don\'t bag fallen leaves! Shred them and use as free mulch for garden beds.', icon: '🍂', level: 'beginner' },
    ],
  },
  10: {
    label: 'November in Atlanta',
    tips: [
      { title: 'Protect Tender Plants', description: 'First frost usually hits mid-November. Cover tomatoes and peppers or harvest green.', icon: '❄️' },
      { title: 'Plant Trees & Shrubs', description: 'Fall planting lets roots establish before summer stress. Great time for fruit trees.', icon: '🌳' },
      { title: 'Clean Up & Compost', description: 'Remove spent plants, add to compost. Healthy gardens start with fall cleanup.', icon: '🧹' },
      { title: 'Indoor Growing', description: 'Move herbs indoors or start microgreens on your kitchen counter for fresh winter greens.', icon: '🏠', level: 'beginner' },
    ],
  },
  11: {
    label: 'December in Atlanta',
    tips: [
      { title: 'Grow Microgreens', description: 'Harvest in 7-10 days on your countertop. Packed with nutrients and perfect for winter.', icon: '🌱' },
      { title: 'Plan Next Year', description: 'Review what worked, what didn\'t. Rotate crop locations to prevent disease buildup.', icon: '📝' },
      { title: 'Maintain Tools', description: 'Clean, sharpen, and oil garden tools. A well-maintained tool lasts decades.', icon: '🔧' },
      { title: 'Gift a Plant', description: 'Seedlings make great holiday gifts! Share the joy of growing with friends and family.', icon: '🎁', level: 'beginner' },
    ],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

const DashboardHome: React.FC<DashboardHomeProps> = ({ userId, customerProfile, onNavigate, onTabChange }) => {
  const { orders, loading: ordersLoading } = useCombinedOrders(userId);
  const { favorites } = useFavorites(userId);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>([]);

  // Fetch featured blog posts
  useEffect(() => {
    async function fetchPosts() {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image_url, category, published_at')
        .eq('is_published', true)
        .eq('is_featured', true)
        .eq('visibility', 'public')
        .order('published_at', { ascending: false })
        .limit(3);
      if (data) setBlogPosts(data);
    }
    fetchPosts();
  }, []);

  // Fetch product details for favorites
  useEffect(() => {
    async function fetchFavoriteProducts() {
      if (!favorites || favorites.length === 0) {
        setFavoriteProducts([]);
        return;
      }
      const productIds = favorites.slice(0, 4);
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, images:product_images(url)')
        .in('id', productIds)
        .limit(4);
      if (data) {
        setFavoriteProducts(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image_url: p.images?.[0]?.url || null,
        })));
      }
    }
    fetchFavoriteProducts();
  }, [favorites]);

  // ─── Derived values ─────────────────────────────────────────────────────

  const firstName = customerProfile?.first_name || '';
  const accountType = customerProfile?.account_type as string | undefined;
  const memberSince = customerProfile?.created_at
    ? new Date(customerProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // Profile completion
  const profileFields = [
    customerProfile?.growing_environment,
    customerProfile?.experience_level,
    (customerProfile?.growing_systems?.length || 0) > 0 ? true : null,
    (customerProfile?.growing_interests?.length || 0) > 0 ? true : null,
  ];
  const completedFields = profileFields.filter(Boolean).length;
  const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

  // Seasonal tips
  const currentMonth = new Date().getMonth();
  const seasonalData = SEASONAL_TIPS[currentMonth];
  const experienceLevel = customerProfile?.experience_level || '';
  const filteredTips = experienceLevel === 'beginner'
    ? seasonalData.tips
    : seasonalData.tips.filter(t => t.level !== 'beginner');

  const recentOrders = (orders || []).slice(0, 3);

  // Account type display
  const getAccountBadge = () => {
    switch (accountType) {
      case 'school_partner': return { label: 'School Partner', perk: '15% discount on all orders' };
      case 'title1_partner': return { label: 'Title I Partner', perk: '20% discount on all orders' };
      case 'wholesale': return { label: 'Wholesale', perk: 'Wholesale pricing on all orders' };
      default: return null;
    }
  };
  const accountBadge = getAccountBadge();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-1">
          {firstName ? `Welcome back, ${firstName}!` : 'Welcome!'}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {memberSince && <span>Member since {memberSince}</span>}
          {accountBadge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {accountBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onTabChange('orders')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Orders</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {ordersLoading ? '—' : orders.length}
          </p>
        </button>

        <button
          onClick={() => onNavigate('shop')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Favorites</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {favorites.length}
          </p>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Profile</span>
          </div>
          <p className="text-3xl font-heading font-extrabold text-gray-900">
            {profileCompletion}%
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Complete</p>
        </button>
      </div>

      {/* Preferred Grower Perks */}
      {accountBadge && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-heading font-bold text-emerald-900">{accountBadge.label}</h2>
            <p className="text-emerald-700 text-sm mt-0.5">{accountBadge.perk}</p>
            <p className="text-emerald-600/70 text-xs mt-1">Discount is automatically applied at checkout.</p>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {!ordersLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="font-heading font-bold text-gray-900">Recent Orders</h2>
            {orders.length > 0 && (
              <button
                onClick={() => onTabChange('orders')}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                View All
              </button>
            )}
          </div>
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order: any) => {
                const statusKey = order.status as OrderStatus;
                const statusConfig = ORDER_STATUS_CONFIG[statusKey];
                const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                });
                const trackingNumber = order.shipments?.[0]?.tracking_number;

                return (
                  <div key={order.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          #{order.order_number || order.id.slice(0, 8)}
                        </span>
                        {statusConfig && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{orderDate}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-heading font-bold text-gray-900 text-sm">
                        ${(order.total || 0).toFixed(2)}
                      </span>
                      {trackingNumber && (
                        <button
                          onClick={() => {
                            window.history.pushState({ view: 'tracking' }, '', `/tracking?number=${trackingNumber}`);
                            onNavigate('tracking');
                          }}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Track
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 pb-6 text-center">
              <p className="text-gray-400 text-sm mb-3">No orders yet</p>
              <button
                onClick={() => onNavigate('shop')}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Start Shopping
              </button>
            </div>
          )}
        </div>
      )}

      {/* Seasonal Growing Tips */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-gray-900">{seasonalData.label}</h2>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Zone 7b/8a
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTips.map((tip, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-colors ${
                tip.level === 'beginner'
                  ? 'border-amber-100 bg-amber-50/50'
                  : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-sm">{tip.title}</h3>
                    {tip.level === 'beginner' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        Beginner
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{tip.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Blog Posts */}
      {blogPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-gray-900">From the Farm</h2>
            <button
              onClick={() => onNavigate('blog')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blogPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  window.history.pushState({ view: 'blog', slug: post.slug }, '', `/blog/${post.slug}`);
                  onNavigate('blog');
                }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left group hover:shadow-md transition-all"
              >
                {post.featured_image_url ? (
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={post.featured_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  {post.category && (
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {post.category}
                    </span>
                  )}
                  <h3 className="font-heading font-bold text-gray-900 mt-2 text-sm group-hover:text-emerald-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{post.excerpt}</p>
                  )}
                  {post.published_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Favorites Preview */}
      {favoriteProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-gray-900">Your Favorites</h2>
            <button
              onClick={() => onNavigate('shop')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {favoriteProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  window.history.pushState({ view: 'shop', product: product.slug }, '', `/shop/${product.slug}`);
                  onNavigate('shop');
                }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left group hover:shadow-md transition-all"
              >
                {product.image_url ? (
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                  </h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Completion CTA */}
      {profileCompletion < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-lg">Complete Your Growing Profile</h2>
              <p className="text-emerald-100 text-sm mt-1">
                {!customerProfile?.growing_environment && 'Tell us about your growing environment. '}
                {!customerProfile?.experience_level && 'Set your experience level. '}
                {!(customerProfile?.growing_systems?.length > 0) && 'Select your growing systems. '}
                {!(customerProfile?.growing_interests?.length > 0) && 'Choose your growing interests. '}
                Help us personalize your experience!
              </p>
            </div>
            <button
              onClick={() => onTabChange('profile')}
              className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-50 transition-colors shrink-0"
            >
              Complete Profile
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardHome;
