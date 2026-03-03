
import React, { useState, useEffect } from 'react';
import { submitNewsletterPreference } from '@/src/services/newsletter';
import { supabase } from '../src/lib/supabase';
import { usePageContent } from '../src/hooks/useSiteContent';

type FooterViewType = 'home' | 'shop' | 'faq' | 'about' | 'privacy' | 'terms' | 'calendar' | 'blog' | 'schools' | 'tools' | 'gift-cards';

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
          .footer-top { grid-template-columns: 1fr; padding: 40px 28px; gap: 40px; }
          .footer-links { padding: 40px 28px !important; gap: 32px !important; }
          .footer-bottom { padding: 20px 28px !important; flex-direction: column; gap: 12px; align-items: flex-start !important; }
        }

        .footer-brand-box {
          background: #e8f4fd;
          border: 1px solid rgba(147,197,253,0.4);
          border-radius: 16px;
          padding: 36px 40px;
        }
        .footer-brand-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .footer-logo-img {
          height: 44px;
          width: auto;
        }
        .footer-tagline {
          font-size: 15px;
          line-height: 1.7;
          color: #1e4d35;
          font-weight: 400;
          max-width: 320px;
          margin-bottom: 28px;
        }
        .footer-socials {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 12px;
          align-items: center;
        }
        .social-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1.5px solid rgba(13,61,42,0.25);
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
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#0d3d2a' }}>
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
                  <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                </a>
              )}
              {brandingSettings?.social_instagram && (
                <a className="social-btn" href={brandingSettings.social_instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
              )}
              {brandingSettings?.social_youtube && (
                <a className="social-btn" href={brandingSettings.social_youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0d3d2a"/></svg>
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
              <li><button onClick={(e) => handleNav(e, 'tools')}>Tools</button></li>
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
          <span className="footer-copyright">&copy; 2025 ATL Urban Farms. All rights reserved.</span>
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
