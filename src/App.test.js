import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders landing page and generate button after start', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /start now/i }));
  expect(screen.getByRole('button', { name: /generate grid/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/quilt width/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/block size/i)).toBeInTheDocument();
});

test('generates a grid from quilt dimensions and block size', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /start now/i }));
  fireEvent.click(screen.getByRole('button', { name: /generate grid/i }));
  expect(
    screen.getByText(/your quilt will be approximately/i)
  ).toBeInTheDocument();
  expect(document.querySelectorAll('.abby-patch__cell').length).toBeGreaterThan(0);
});
