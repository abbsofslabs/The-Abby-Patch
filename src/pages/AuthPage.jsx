import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/abby-patch-logo.png';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [role, setRole] = useState('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        const { profile } = await signIn(email.trim(), password);
        navigate(profile?.role === 'store' ? '/store' : '/design');
        return;
      }

      const { profile } = await signUp(email.trim(), password, role);
      navigate(profile?.role === 'store' || role === 'store' ? '/store' : '/design');
    } catch (submitError) {
      if (submitError.code === 'account_exists') {
        setMode('signin');
        setError('You already have an account with this email. Please sign in.');
      } else {
        setError(submitError.message || 'Unable to complete authentication.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="abby-patch abby-patch__auth-page">
      <section className="abby-patch__auth-card abby-patch__panel">
        <img src={logo} alt="The Abby Patch" className="abby-patch__auth-logo" />
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="abby-patch__auth-subtitle">
          {mode === 'signin'
            ? 'Welcome back to The Abby Patch.'
            : 'Choose whether you are shopping for fabric or running a quilt shop.'}
        </p>

        <form className="abby-patch__auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <fieldset className="abby-patch__role-picker">
              <legend>Account type</legend>
              <label>
                <input
                  type="radio"
                  name="role"
                  value="customer"
                  checked={role === 'customer'}
                  onChange={() => setRole('customer')}
                />
                Customer — design quilts and shop store fabrics
              </label>
              <label>
                <input
                  type="radio"
                  name="role"
                  value="store"
                  checked={role === 'store'}
                  onChange={() => setRole('store')}
                />
                Store — upload fabrics and pricing for customers
              </label>
            </fieldset>
          )}

          <div className="abby-patch__input-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="abby-patch__input-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && <p className="abby-patch__auth-error">{error}</p>}

          <button type="submit" className="abby-patch__button" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="abby-patch__auth-switch">
          {mode === 'signin' ? (
            <>
              Need an account?{' '}
              <button type="button" className="abby-patch__link-button" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="abby-patch__link-button" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="abby-patch__auth-switch">
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </div>
  );
}
