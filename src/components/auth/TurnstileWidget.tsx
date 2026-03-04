import React from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError: () => void;
  onExpire: () => void;
}

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ onSuccess, onError, onExpire }) => {
  const siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onSuccess}
        onError={onError}
        onExpire={onExpire}
        options={{
          theme: 'light',
          size: 'normal',
        }}
      />
    </div>
  );
};

export default TurnstileWidget;
