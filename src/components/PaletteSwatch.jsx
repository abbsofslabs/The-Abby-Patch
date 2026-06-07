import { memo, useCallback } from 'react';

function PaletteSwatch({ name, hex, isSelected, isLight, onSelect }) {
  const handleClick = useCallback(() => {
    onSelect(hex);
  }, [hex, onSelect]);

  const className = [
    'abby-patch__palette-swatch',
    isLight ? 'abby-patch__palette-swatch--light' : '',
    isSelected ? 'abby-patch__palette-swatch--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={name}
      className={className}
      style={{ backgroundColor: hex }}
      onClick={handleClick}
    />
  );
}

export default memo(PaletteSwatch);
