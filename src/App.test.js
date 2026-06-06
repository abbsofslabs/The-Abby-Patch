import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders AbbyPatch title and generate button', () => {
  render(<App />);
  expect(screen.getByText('AbbyPatch')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /generate grid/i })).toBeInTheDocument();
});

test('generates a grid when button is clicked', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /generate grid/i }));
  expect(document.querySelectorAll('.abby-patch__cell')).toHaveLength(16);
});
