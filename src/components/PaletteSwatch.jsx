import { memo, useCallback } from 'react';

function PaletteSwatch({ name, hex, isSelected, onSelect }) {
  const handleClick = useCallback(() => {
    onSelect(hex);
  }, [hex, onSelect]);

  const className = isSelected
    ? 'abby-patch__palette-swatch abby-patch__palette-swatch--selected'
    : 'abby-patch__palette-swatch';

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
