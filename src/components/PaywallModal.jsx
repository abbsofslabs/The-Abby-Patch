import { memo, useState } from 'react';

function PaywallModal({
  initialEmail,
  onClose,
  onPaySingle,
  onSubscribe,
  isCheckoutLoading,
}) {
  const [email, setEmail] = useState(initialEmail);

  return (
    <div className="abby-patch__modal-overlay" role="presentation">
      <div
        className="abby-patch__modal abby-patch__modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
      >
        <button
          type="button"
          className="abby-patch__modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="paywall-title" className="abby-patch__modal-title">
          Get more patterns
        </h2>

        <label htmlFor="paywall-email" className="abby-patch__modal-label">
          Email
        </label>
        <input
          id="paywall-email"
          type="email"
          className="abby-patch__modal-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <div className="abby-patch__paywall-options">
          <div className="abby-patch__paywall-option">
            <h3 className="abby-patch__paywall-option-title">Single pattern</h3>
            <p className="abby-patch__paywall-price">$2</p>
            <p className="abby-patch__paywall-desc">One-time download of this pattern.</p>
            <button
              type="button"
              className="abby-patch__button abby-patch__button--modal"
              disabled={isCheckoutLoading}
              onClick={() => onPaySingle(email.trim())}
            >
              Pay $2
            </button>
          </div>

          <div className="abby-patch__paywall-option abby-patch__paywall-option--featured">
            <h3 className="abby-patch__paywall-option-title">Unlimited</h3>
            <p className="abby-patch__paywall-price">$10/month</p>
            <p className="abby-patch__paywall-desc">Download as many patterns as you like.</p>
            <button
              type="button"
              className="abby-patch__button abby-patch__button--modal"
              disabled={isCheckoutLoading}
              onClick={() => onSubscribe(email.trim())}
            >
              Subscribe $10/month
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(PaywallModal);
