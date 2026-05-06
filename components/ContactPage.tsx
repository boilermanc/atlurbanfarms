
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';

interface ContactPageProps {
  onNavigate?: (view: string) => void;
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

const FALLBACK: BusinessSettings = {
  support_email: 'hello@atlurbanfarms.com',
  support_phone: '',
  ship_from_address_line1: '180 Tidwell Drive',
  ship_from_address_line2: '',
  ship_from_city: 'Atlanta',
  ship_from_state: 'GA',
  ship_from_zip: '30318',
};

// Sheree's photo — placeholder until updated headshots are cropped.
const SHEREE_IMAGE = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<BusinessSettings>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('config_settings')
          .select('key, value')
          .eq('category', 'business');
        if (error) throw error;
        if (!data || cancelled) return;

        const map: Record<string, string> = {};
        data.forEach((row: { key: string; value: string }) => {
          map[row.key] = row.value;
        });

        setSettings({
          support_email: map.support_email || FALLBACK.support_email,
          support_phone: map.support_phone || FALLBACK.support_phone,
          ship_from_address_line1: map.ship_from_address_line1 || FALLBACK.ship_from_address_line1,
          ship_from_address_line2: map.ship_from_address_line2 || FALLBACK.ship_from_address_line2,
          ship_from_city: map.ship_from_city || FALLBACK.ship_from_city,
          ship_from_state: map.ship_from_state || FALLBACK.ship_from_state,
          ship_from_zip: map.ship_from_zip || FALLBACK.ship_from_zip,
        });
      } catch (err) {
        console.error('ContactPage: failed to load business settings', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullAddress = [
    settings.ship_from_address_line1,
    settings.ship_from_address_line2,
    `${settings.ship_from_city}, ${settings.ship_from_state} ${settings.ship_from_zip}`,
  ]
    .filter(Boolean)
    .join(', ');

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

  const handleCalendarClick = () => {
    if (onNavigate) {
      onNavigate('calendar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 bg-site selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.span
            variants={fadeIn}
            className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block"
          >
            Get In Touch
          </motion.span>
          <motion.h1
            variants={fadeIn}
            className="text-4xl md:text-5xl font-heading font-extrabold text-gray-900 mb-8 leading-[1.1]"
          >
            Let's <span className="sage-text-gradient">Connect</span>
          </motion.h1>
          <motion.p variants={fadeIn} className="text-xl text-gray-500 leading-relaxed">
            Questions about your order, plant care, or visiting the farm? I'd love to hear from you.
          </motion.p>
        </motion.div>
      </section>

      {/* Personal note from Sheree */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center bg-white rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm"
        >
          <div className="md:col-span-2">
            <div className="relative rounded-[2rem] overflow-hidden aspect-square shadow-xl">
              <img
                src={SHEREE_IMAGE}
                alt="Sheree, ATL Urban Farms"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <span className="text-emerald-600 font-bold uppercase tracking-widest text-xs mb-4 block">
              A Note From Sheree
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-gray-900 mb-6 leading-tight">
              Every plant has a story — and so do you.
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Hi, I'm Sheree. I run farm operations at ATL Urban Farms, which means I spend my days with our seedlings and the people who grow them. If something on your order looks off, if you're not sure which variety to plant, or if you just want to chat about gardening — please reach out.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We're a small team, so when you email or call us, you're talking to someone who actually knows the plants. I'll get back to you as quickly as I can.
            </p>
            <p className="mt-6 font-heading text-2xl text-emerald-700 italic">— Sheree</p>
          </div>
        </motion.div>
      </section>

      {/* Contact details */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Email */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Email</h3>
            <a
              href={`mailto:${settings.support_email}`}
              className="text-emerald-700 font-semibold hover:text-emerald-900 break-all"
            >
              {settings.support_email}
            </a>
          </motion.div>

          {/* Phone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Phone</h3>
            {settings.support_phone ? (
              <a
                href={`tel:${settings.support_phone}`}
                className="text-emerald-700 font-semibold hover:text-emerald-900"
              >
                {settings.support_phone}
              </a>
            ) : (
              <span className="text-gray-400 italic text-sm">Coming soon</span>
            )}
          </motion.div>

          {/* Address */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Visit</h3>
            <address className="not-italic text-gray-600 leading-relaxed mb-3">
              {settings.ship_from_address_line1}
              {settings.ship_from_address_line2 && (
                <>
                  <br />
                  {settings.ship_from_address_line2}
                </>
              )}
              <br />
              {settings.ship_from_city}, {settings.ship_from_state} {settings.ship_from_zip}
            </address>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:text-emerald-900 text-sm"
            >
              Get directions
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Hours */}
      <section className="max-w-7xl mx-auto px-4 md:px-12 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-emerald-50 rounded-[2.5rem] p-10 border border-emerald-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="text-2xl font-heading font-extrabold text-gray-900">Support Hours</h3>
            </div>
            <ul className="space-y-3 text-gray-700">
              <li className="flex justify-between border-b border-emerald-100 pb-2">
                <span className="font-semibold">Monday – Friday</span>
                <span>Open</span>
              </li>
              <li className="flex justify-between border-b border-emerald-100 pb-2">
                <span className="font-semibold">Saturday</span>
                <span>Until 12:00 PM</span>
              </li>
              <li className="flex justify-between">
                <span className="font-semibold">Sunday</span>
                <span className="text-gray-400">Closed</span>
              </li>
            </ul>
            <p className="mt-6 text-sm text-gray-600 leading-relaxed bg-white/60 rounded-2xl p-4 border border-emerald-100">
              Messages received after <strong>12:00 PM Saturday</strong> will be returned <strong>Monday morning</strong>.
            </p>
          </div>

          <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3 className="text-2xl font-heading font-extrabold">Open Hours & Events</h3>
              </div>
              <p className="text-gray-300 leading-relaxed mb-8">
                See when the farm is open to the public, plus upcoming workshops, pickups, and community events.
              </p>
              <button
                onClick={handleCalendarClick}
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/40"
              >
                View the Calendar
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default ContactPage;
