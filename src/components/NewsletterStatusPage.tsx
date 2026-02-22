import React from 'react';
import { motion } from 'framer-motion';

interface NewsletterStatusPageProps {
  type: 'confirmed' | 'unsubscribed';
  onNavigate?: (view: string) => void;
}

const statusConfig = {
  confirmed: {
    success: {
      icon: (
        <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      title: "You're Confirmed!",
      message: "Your email has been verified. You're now subscribed to the ATL Urban Farms newsletter.",
      color: 'emerald',
    },
    expired: {
      icon: (
        <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
      ),
      title: 'Link Expired',
      message: 'This confirmation link has expired. Please sign up again to receive a new one.',
      color: 'amber',
    },
    invalid: {
      icon: (
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
      title: 'Invalid Link',
      message: "This confirmation link isn't valid. It may have already been used.",
      color: 'red',
    },
    'already-active': {
      icon: (
        <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      title: 'Already Subscribed',
      message: "You're already subscribed to the ATL Urban Farms newsletter. No action needed!",
      color: 'emerald',
    },
    error: {
      icon: (
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
        </svg>
      ),
      title: 'Something Went Wrong',
      message: 'We had trouble processing your confirmation. Please try again later.',
      color: 'red',
    },
  },
  unsubscribed: {
    success: {
      icon: (
        <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "You've Been Unsubscribed",
      message: "You won't receive any more marketing emails from us. We're sorry to see you go!",
      color: 'gray',
    },
    already: {
      icon: (
        <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      title: 'Already Unsubscribed',
      message: "You're already unsubscribed from our marketing emails.",
      color: 'gray',
    },
    invalid: {
      icon: (
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
      title: 'Invalid Link',
      message: "This unsubscribe link isn't valid.",
      color: 'red',
    },
    error: {
      icon: (
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
        </svg>
      ),
      title: 'Something Went Wrong',
      message: 'We had trouble processing your request. Please try again later.',
      color: 'red',
    },
  },
} as const;

type StatusKey<T extends 'confirmed' | 'unsubscribed'> = keyof typeof statusConfig[T];

const NewsletterStatusPage: React.FC<NewsletterStatusPageProps> = ({ type, onNavigate }) => {
  const params = new URLSearchParams(window.location.search);
  const statusParam = params.get('status') || 'error';

  const configs = statusConfig[type];
  const config = (configs as unknown as Record<string, typeof configs[keyof typeof configs]>)[statusParam] || configs.error;

  return (
    <div className="min-h-screen bg-site flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-50 flex items-center justify-center">
            {config.icon}
          </div>

          <h1 className="text-2xl font-heading font-extrabold text-gray-900 mb-3">
            {config.title}
          </h1>

          <p className="text-gray-500 leading-relaxed mb-8">
            {config.message}
          </p>

          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate('home');
              } else {
                window.location.href = '/';
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to ATL Urban Farms
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default NewsletterStatusPage;
