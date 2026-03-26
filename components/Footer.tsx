
import React, { useState, useEffect } from 'react';
import { submitNewsletterPreference } from '@/src/services/newsletter';
import { supabase } from '../src/lib/supabase';
import { usePageContent } from '../src/hooks/useSiteContent';

type FooterViewType = 'home' | 'shop' | 'faq' | 'about' | 'privacy' | 'terms' | 'calendar' | 'blog' | 'schools' | 'gift-cards';

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

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const { getSection } = usePageContent('footer');

  const mainContent = getSection('main');
  const newsletterContent = getSection('newsletter');

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

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    [
      businessSettings?.ship_from_address_line1 || '123 High-Tech Way',
      businessSettings?.ship_from_address_line2,
      `${businessSettings?.ship_from_city || 'Atlanta'}, ${businessSettings?.ship_from_state || 'GA'} ${businessSettings?.ship_from_zip || '30318'}`,
    ].filter(Boolean).join(', ')
  )}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

        .atl-footer {
          background-color: #0d3d2a;
          font-family: 'DM Sans', sans-serif;
          color: #ffffff;
          overflow: hidden;
        }

        .footer-top {
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding: 56px 64px 52px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }

        @media (max-width: 900px) {
          .footer-top {
            grid-template-columns: 1fr;
            padding: 40px 24px;
            gap: 24px;
          }
          .footer-brand-box {
            padding: 28px 24px;
            flex-direction: column;
            text-align: center;
          }
          .footer-tagline {
            text-align: center;
          }
          .newsletter-box {
            padding: 28px 24px;
          }
          .footer-links {
            padding: 40px 24px !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px 24px !important;
          }
          .footer-bottom {
            padding: 20px 24px !important;
            flex-direction: column;
            gap: 16px;
            align-items: center !important;
            text-align: center;
          }
          .footer-legal {
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .footer-top {
            padding: 32px 16px;
            gap: 20px;
          }
          .footer-brand-box {
            padding: 24px 20px;
          }
          .footer-tagline {
            font-size: 14px;
          }
          .newsletter-box {
            padding: 24px 20px;
          }
          .newsletter-heading {
            font-size: 22px;
          }
          .newsletter-row {
            flex-direction: column;
          }
          .newsletter-btn {
            width: 100%;
          }
          .footer-links {
            padding: 32px 16px !important;
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .footer-bottom {
            padding: 16px !important;
          }
          .contact-links {
            flex-direction: row;
          }
        }

        .footer-brand-box {
          background: #e8f4fd;
          border: 1px solid rgba(147,197,253,0.4);
          border-radius: 16px;
          padding: 36px 40px;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .footer-brand-logo {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .footer-logo-img {
          height: 72px;
          width: auto;
        }
        .footer-tagline {
          font-size: 15px;
          line-height: 1.7;
          color: #1e4d35;
          font-weight: 400;
          flex: 1;
          margin: 0;
        }
        .footer-socials {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }
        .social-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid rgba(13,61,42,0.2);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #0d3d2a;
          text-decoration: none;
        }
        .social-btn:hover {
          border-color: #0d3d2a;
          background: rgba(13,61,42,0.08);
          color: #0d3d2a;
          transform: translateY(-2px);
        }
        .social-btn svg { width: 18px; height: 18px; fill: currentColor; }

        .newsletter-box {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          padding: 36px 40px;
          position: relative;
          overflow: hidden;
        }
        .newsletter-envelope {
          position: absolute;
          top: 28px;
          right: 32px;
          color: #c4dece;
          pointer-events: none;
        }
        .newsletter-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #0d3d2a;
          margin-bottom: 10px;
        }
        .newsletter-heading {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 700;
          color: #0d3d2a;
          margin: 0 0 8px;
          line-height: 1.3;
        }
        .newsletter-sub {
          font-size: 14px;
          color: #4b7a5e;
          font-weight: 400;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .newsletter-row {
          display: flex;
          gap: 10px;
        }
        .newsletter-input {
          flex: 1;
          background: #f3f8f5;
          border: 1.5px solid #c4dece;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
          color: #0d3d2a;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s;
        }
        .newsletter-input::placeholder { color: #8aad9b; }
        .newsletter-input:focus { border-color: #166534; }
        .newsletter-btn {
          background: #166534;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .newsletter-btn:hover {
          background: #0d3d2a;
          transform: translateY(-1px);
        }
        .newsletter-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .newsletter-fine {
          font-size: 12px;
          color: #8aad9b;
          margin-top: 12px;
        }
        .newsletter-success {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #166534;
          font-size: 15px;
          font-weight: 500;
          padding: 8px 0;
        }
        .newsletter-error {
          font-size: 13px;
          color: #dc2626;
          margin-top: 8px;
        }

        .footer-links {
          padding: 52px 64px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
        }
        .footer-col-heading {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #f5f0e0;
          margin-bottom: 20px;
        }
        .footer-links-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .footer-links-list li a,
        .footer-links-list li button {
          font-size: 14.5px;
          color: #e0f2ea;
          text-decoration: none;
          font-weight: 400;
          transition: color 0.15s;
          cursor: pointer;
          display: block;
          line-height: 1.4;
          background: none;
          border: none;
          padding: 0;
          text-align: left;
          font-family: inherit;
        }
        .footer-links-list li a:hover,
        .footer-links-list li button:hover { color: #ffffff; }

        .contact-label {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(245,240,224,0.5);
          margin-top: 20px;
          margin-bottom: 8px;
        }
        .contact-label:first-child {
          margin-top: 0;
        }
        .contact-address {
          font-size: 14px;
          color: #e0f2ea;
          line-height: 1.6;
          font-weight: 300;
          margin-bottom: 10px;
        }
        .contact-links {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .contact-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          color: #f5f0e0;
          text-decoration: none;
          border: 1px solid rgba(245,240,224,0.35);
          padding: 4px 10px;
          border-radius: 20px;
          transition: all 0.15s;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }
        .contact-chip:hover {
          background: rgba(245,240,224,0.12);
          border-color: #f5f0e0;
        }
        .contact-detail {
          font-size: 14px;
          color: #e0f2ea;
          font-weight: 300;
        }
        .contact-detail a {
          color: #e0f2ea;
          text-decoration: none;
          transition: color 0.15s;
        }
        .contact-detail a:hover {
          color: #ffffff;
        }

        .footer-bottom {
          padding: 20px 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-copyright {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          font-weight: 300;
        }
        .footer-legal {
          display: flex;
          gap: 24px;
          align-items: center;
        }
        .footer-legal button {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          transition: color 0.15s;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .footer-legal button:hover { color: rgba(255,255,255,0.9); }
        .footer-legal-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
        }
        .footer-built {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
      `}</style>

      <footer className="atl-footer">

        {/* Top Section: Brand + Newsletter */}
        <div className="footer-top">

          {/* Brand Box */}
          <div className="footer-brand-box">
            <div className="footer-brand-logo">
              {brandingSettings?.logo_url ? (
                <img
                  src={brandingSettings.logo_url}
                  alt="ATL Urban Farms"
                  className="footer-logo-img"
                />
              ) : (
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: '#0d3d2a' }}>
                  ATL Urban Farms
                </span>
              )}
            </div>
            <p className="footer-tagline">
              {mainContent.tagline || 'Plant People Helping Plant People. Premium seedlings and expert support for every aeroponic gardener.'}
            </p>
            <div className="footer-socials">
              {brandingSettings?.social_facebook && (
                <a className="social-btn" href={brandingSettings.social_facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {brandingSettings?.social_instagram && (
                <a className="social-btn" href={brandingSettings.social_instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              )}
              {brandingSettings?.social_youtube && (
                <a className="social-btn" href={brandingSettings.social_youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              )}
              {brandingSettings?.social_pinterest && (
                <a className="social-btn" href={brandingSettings.social_pinterest} target="_blank" rel="noopener noreferrer" aria-label="Pinterest">
                  <svg viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
                </a>
              )}
              {brandingSettings?.social_linkedin && (
                <a className="social-btn" href={brandingSettings.social_linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              )}
            </div>
          </div>

          {/* Newsletter Box */}
          <div className="newsletter-box">
            <div className="newsletter-envelope">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>
            <div className="newsletter-eyebrow">Newsletter</div>
            <h3 className="newsletter-heading">{newsletterContent.headline || 'Join the Garden'}</h3>
            <p className="newsletter-sub">
              {newsletterContent.description || 'Growing tips, nursery updates, and early access to seasonal seedlings.'}
            </p>
            {status === 'success' ? (
              <div className="newsletter-success">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                {message}
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit}>
                <div className="newsletter-row">
                  <input
                    className="newsletter-input"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status !== 'idle') {
                        setStatus('idle');
                        setMessage(null);
                      }
                    }}
                    aria-label="Email address"
                    required
                  />
                  <button
                    className="newsletter-btn"
                    type="submit"
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Sending...' : 'Subscribe'}
                  </button>
                </div>
                <p className="newsletter-fine">
                  By subscribing you agree to receive newsletters. Unsubscribe anytime.
                </p>
                {status === 'error' && message && (
                  <p className="newsletter-error" role="status">{message}</p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Link Grid */}
        <div className="footer-links">
          <div>
            <div className="footer-col-heading">Shop</div>
            <ul className="footer-links-list">
              <li><button onClick={(e) => handleNav(e, 'shop', 'Seedlings')}>Seedlings</button></li>
              <li><button onClick={(e) => handleNav(e, 'shop', 'Supplies')}>Supplies</button></li>
              <li><button onClick={(e) => handleNav(e, 'shop', 'Merchandise')}>Merchandise</button></li>
              <li><button onClick={(e) => handleNav(e, 'gift-cards')}>Gift Cards</button></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-heading">Company</div>
            <ul className="footer-links-list">
              <li><button onClick={(e) => handleNav(e, 'about')}>About Us</button></li>
              <li><button onClick={(e) => { handleNav(e, 'about'); setTimeout(() => { document.getElementById('growers')?.scrollIntoView({ behavior: 'smooth' }); }, 100); }}>Meet the Growers</button></li>
              <li><button onClick={(e) => handleNav(e, 'about')}>Our Story</button></li>
              <li><button onClick={(e) => handleNav(e, 'calendar')}>Calendar</button></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-heading">Support</div>
            <ul className="footer-links-list">
              <li><button onClick={(e) => handleNav(e, 'faq')}>FAQ</button></li>
              <li><button onClick={(e) => handleNav(e, 'blog')}>Blog</button></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-heading">Contact</div>
            <div className="contact-label">Visit Our Nursery</div>
            <div className="contact-address">
              {businessSettings?.ship_from_address_line1 || '123 High-Tech Way'}
              {businessSettings?.ship_from_address_line2 && <><br />{businessSettings.ship_from_address_line2}</>}
              <br />
              {businessSettings?.ship_from_city || 'Atlanta'}, {businessSettings?.ship_from_state || 'GA'} {businessSettings?.ship_from_zip || '30318'}
            </div>
            <div className="contact-links">
              <a
                className="contact-chip"
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Directions
              </a>
              <button
                className="contact-chip"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigate) {
                    onNavigate('calendar', undefined, { calendarFilter: 'open_hours' });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Hours
              </button>
            </div>
            <div className="contact-label">Grow Support</div>
            <div className="contact-detail">
              {businessSettings?.support_email ? (
                <a href={`mailto:${businessSettings.support_email}`}>{businessSettings.support_email}</a>
              ) : (
                <span>hello@atlurbanfarms.com</span>
              )}
            </div>
            {businessSettings?.support_phone && (
              <div className="contact-detail">
                <a href={`tel:${businessSettings.support_phone}`}>{businessSettings.support_phone}</a>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <span className="footer-copyright">&copy; 2026 ATL Urban Farms. All rights reserved.</span>
          <div className="footer-legal">
            <button onClick={(e) => handleNav(e, 'terms')}>Terms of Service</button>
            <div className="footer-legal-dot" />
            <button onClick={(e) => handleNav(e, 'privacy')}>Privacy Policy</button>
          </div>
          <span className="footer-built">Built by Sweetwater Technology</span>
        </div>

      </footer>
    </>
  );
};

export default Footer;
