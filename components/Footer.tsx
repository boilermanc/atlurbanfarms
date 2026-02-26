
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SparkleIcon } from '../constants';
import { submitNewsletterPreference } from '@/src/services/newsletter';
import { supabase } from '../src/lib/supabase';
import { usePageContent } from '../src/hooks/useSiteContent';

type FooterViewType = 'home' | 'shop' | 'faq' | 'about' | 'privacy' | 'terms' | 'calendar' | 'blog' | 'schools' | 'tools';

interface FooterProps {
  onNavigate?: (view: FooterViewType, category?: string, options?: { calendarFilter?: string }) => void;
}

interface BusinessSettings {
  support_email: string;
  support_phone: string;
  ship_from_address_line1: string;
  ship_from_address_line2: string;
  ship_from_city: string;
  ship_from_state: string;
  ship_from_zip: string;
}

interface BrandingSettings {
  logo_url: string;
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_youtube: string;
  social_tiktok: string;
  social_pinterest: string;
  social_linkedin: string;
}

// Helper to scroll to an element by ID, with fallback IDs
const scrollToSection = (...ids: string[]) => {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }
};

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const { getSection } = usePageContent('footer');

  // Get CMS content
  const mainContent = getSection('main');
  const newsletterContent = getSection('newsletter');

  // Fetch business and branding settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('config_settings')
          .select('category, key, value')
          .in('category', ['business', 'branding']);

        if (error) throw error;

        if (data) {
          const businessData: Record<string, string> = {};
          const brandingData: Record<string, string> = {};

          data.forEach((row: { category: string; key: string; value: string }) => {
            if (row.category === 'business') {
              businessData[row.key] = row.value;
            } else if (row.category === 'branding') {
              brandingData[row.key] = row.value;
            }
          });

          setBusinessSettings({
            support_email: businessData.support_email || '',
            support_phone: businessData.support_phone || '',
            ship_from_address_line1: businessData.ship_from_address_line1 || '',
            ship_from_address_line2: businessData.ship_from_address_line2 || '',
            ship_from_city: businessData.ship_from_city || 'Atlanta',
            ship_from_state: businessData.ship_from_state || 'GA',
            ship_from_zip: businessData.ship_from_zip || '',
          });

          setBrandingSettings({
            logo_url: brandingData.logo_url || '',
            social_facebook: brandingData.social_facebook || '',
            social_instagram: brandingData.social_instagram || '',
            social_twitter: brandingData.social_twitter || '',
            social_youtube: brandingData.social_youtube || '',
            social_tiktok: brandingData.social_tiktok || '',
            social_pinterest: brandingData.social_pinterest || '',
            social_linkedin: brandingData.social_linkedin || '',
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchSettings();
  }, []);

  const handleNav = (e: React.MouseEvent, view: FooterViewType, category?: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(view, category);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    try {
      setStatus('loading');
      await submitNewsletterPreference({
        email: trimmedEmail,
        source: 'footer',
      });
      setStatus('success');
      setMessage('Check your email to confirm your subscription!');
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  const shopLinks = [
    { label: 'Seedlings', cat: 'Seedlings' },
    { label: 'Supplies', cat: 'Supplies' },
    { label: 'Merchandise', cat: 'Merchandise' },
  ];

  return (
    <footer className="bg-emerald-900 text-white pt-16 pb-10 px-4 md:px-12 overflow-hidden relative border-t border-white/5">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] -z-0 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Section: Brand & Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={(e) => handleNav(e, 'home')} className="flex items-center gap-3 group text-left">
                {brandingSettings?.logo_url ? (
                  <img
                    src={brandingSettings.logo_url}
                    alt="ATL Urban Farms"
                    className="h-14 w-auto object-contain group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <>
                    <div className="w-12 h-12 brand-bg rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl group-hover:rotate-6 transition-transform">
                      A
                    </div>
                    <span className="font-heading text-2xl font-black tracking-tight">
                      ATL <span className="brand-text">Urban Farms</span>
                    </span>
                  </>
                )}
              </button>
            </div>
            <p className="text-gray-400 text-lg leading-relaxed max-w-md mb-10">
              {mainContent.tagline || 'Transforming urban spaces with premium, nursery-grown seedlings. High-tech growing for the modern gardener.'}
            </p>
            <div className="flex gap-4">
              {brandingSettings?.social_facebook && (
                <motion.a
                  href={brandingSettings.social_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_instagram && (
                <motion.a
                  href={brandingSettings.social_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="Instagram"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_twitter && (
                <motion.a
                  href={brandingSettings.social_twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="Twitter/X"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_tiktok && (
                <motion.a
                  href={brandingSettings.social_tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="TikTok"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_youtube && (
                <motion.a
                  href={brandingSettings.social_youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="YouTube"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_pinterest && (
                <motion.a
                  href={brandingSettings.social_pinterest}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="Pinterest"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17.5c.5-1.5 1-3 1.5-4.5.5-1.5.5-2.5.5-3.5a5 5 0 0 1 10 0c0 1-.1 2-.5 3.5-.5 1.5-1 3-1.5 4.5"/><path d="M8 14s1.5-2 4-2 4 2 4 2"/></svg>
                </motion.a>
              )}
              {brandingSettings?.social_linkedin && (
                <motion.a
                  href={brandingSettings.social_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="w-12 h-12 bg-white/5 hover:bg-emerald-600/20 hover:text-emerald-400 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                  aria-label="LinkedIn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                </motion.a>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white/5 rounded-[3rem] p-8 md:p-12 border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <SparkleIcon className="w-24 h-24 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-heading font-extrabold mb-4">{newsletterContent.headline || 'Join the Garden'}</h3>
              <p className="text-gray-400 mb-8 max-w-sm">{newsletterContent.description || 'Get growing tips, nursery updates, and early access to rare seasonal seedlings.'}</p>
              
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status !== 'idle') {
                      setStatus('idle');
                      setMessage(null);
                    }
                  }}
                  placeholder="Enter your email" 
                  className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  aria-label="Email address"
                  required
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className={`px-8 py-4 rounded-2xl font-bold transition-all shadow-lg whitespace-nowrap flex items-center justify-center gap-2 ${
                    status === 'loading'
                      ? 'bg-white/20 text-white/70 cursor-not-allowed'
                      : 'brand-bg text-white hover:bg-white hover:scale-[1.02] active:scale-95'
                  }`}
                  style={status !== 'loading' ? { ['--hover-text' as string]: 'var(--brand-primary)' } : undefined}
                  onMouseEnter={(e) => status !== 'loading' && (e.currentTarget.style.color = 'var(--brand-primary)')}
                  onMouseLeave={(e) => status !== 'loading' && (e.currentTarget.style.color = '')}
                >
                  {status === 'loading' ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </form>
              <p className="mt-3 text-xs text-gray-500">
                By subscribing, you agree to receive newsletters and promotional content. Unsubscribe anytime.
              </p>
              {message && (
                <p
                  className={`mt-4 text-sm ${status === 'success' ? 'text-emerald-300' : 'text-rose-200'}`}
                  role="status"
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Link Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 border-b border-white/10 pb-12">
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 brand-text uppercase tracking-widest text-xs">Shop</h4>
            <ul className="space-y-4">
              {shopLinks.map(item => (
                <li key={item.label}>
                  <button 
                    onClick={(e) => handleNav(e, 'shop', item.cat)} 
                    className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 brand-text uppercase tracking-widest text-xs">Company</h4>
            <ul className="space-y-4">
              <li><button onClick={(e) => handleNav(e, 'about')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">About Us</button></li>
              <li><button onClick={(e) => { handleNav(e, 'about'); setTimeout(() => { document.getElementById('growers')?.scrollIntoView({ behavior: 'smooth' }); }, 100); }} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Meet the Growers</button></li>
              <li><button onClick={(e) => handleNav(e, 'about')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Our Story</button></li>
              <li><button onClick={(e) => handleNav(e, 'calendar')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Calendar</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 brand-text uppercase tracking-widest text-xs">Support</h4>
            <ul className="space-y-4">
              <li><button onClick={(e) => handleNav(e, 'faq')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">FAQ</button></li>
              <li><button onClick={(e) => handleNav(e, 'blog')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Blog</button></li>
              <li><button onClick={(e) => handleNav(e, 'schools')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Schools</button></li>
              <li><button onClick={(e) => handleNav(e, 'tools')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Tools</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-8 brand-text uppercase tracking-widest text-xs">Contact</h4>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Visit Our Nursery</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {businessSettings?.ship_from_address_line1 || '123 High-Tech Way'}
                  {businessSettings?.ship_from_address_line2 && <><br />{businessSettings.ship_from_address_line2}</>}
                  <br />
                  {businessSettings?.ship_from_city || 'Atlanta'}, {businessSettings?.ship_from_state || 'GA'} {businessSettings?.ship_from_zip || '30318'}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    [
                      businessSettings?.ship_from_address_line1 || '123 High-Tech Way',
                      businessSettings?.ship_from_address_line2,
                      `${businessSettings?.ship_from_city || 'Atlanta'}, ${businessSettings?.ship_from_state || 'GA'} ${businessSettings?.ship_from_zip || '30318'}`,
                    ].filter(Boolean).join(', ')
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors mt-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Get Directions
                </a>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) {
                      onNavigate('calendar', undefined, { calendarFilter: 'open_hours' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors mt-2 ml-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  View Open Hours
                </button>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Grow Support</p>
                {businessSettings?.support_email ? (
                  <a
                    href={`mailto:${businessSettings.support_email}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors block"
                  >
                    {businessSettings.support_email}
                  </a>
                ) : (
                  <span className="text-gray-400 text-sm">hello@atlurbanfarms.com</span>
                )}
                {businessSettings?.support_phone && (
                  <a
                    href={`tel:${businessSettings.support_phone}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors block mt-1"
                  >
                    {businessSettings.support_phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">
              © 2025 ATL URBAN FARMS. ALL RIGHTS RESERVED.
            </p>
            <div className="flex gap-6">
              <button onClick={(e) => handleNav(e, 'terms')} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Terms of Service</button>
              <button onClick={(e) => handleNav(e, 'privacy')} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Privacy Policy</button>
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600/60">
            Built by Sweetwater Technology
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
