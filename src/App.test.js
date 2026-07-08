import { render, screen } from '@testing-library/react';
import LandingPage from './pages/LandingPage';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

test('renders landing page with sign in', () => {
  render(<LandingPage />);
  expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
});

test('renders create account link on landing page', () => {
  render(<LandingPage />);
  expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
});
