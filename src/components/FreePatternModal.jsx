import { memo, useState } from 'react';

function FreePatternModal({ initialEmail, onSubmit }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <div className="abby-patch__modal-overlay" role="presentation">
      <div
        className="abby-patch__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-pattern-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="free-pattern-title" className="abby-patch__modal-title">
          Get your free pattern
        </h2>
        <p className="abby-patch__modal-desc">
          Your first pattern download is free. Enter your email to get started — after that,
          additional downloads cost $2 each or $10/month for unlimited.
        </p>
        <form onSubmit={handleSubmit} className="abby-patch__modal-form">
          <label htmlFor="free-pattern-email" className="abby-patch__modal-label">
            Email
          </label>
          <input
            id="free-pattern-email"
            type="email"
            className="abby-patch__modal-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {error && <p className="abby-patch__modal-error">{error}</p>}
          <button type="submit" className="abby-patch__button abby-patch__button--modal">
            Download free
          </button>
        </form>
      </div>
    </div>
  );
}

export default memo(FreePatternModal);
