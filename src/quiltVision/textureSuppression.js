import { separableBoxBlur } from './fastBlur';

export function sensitivityToFabricParams(sensitivity) {
  const level = Math.max(1, Math.min(100, sensitivity)) / 100;

  return {
    blurRadius: Math.round(2 + level * 3),
    colorThreshold: 6 + (1 - level) * 32,
    minRegionPixels: Math.round(80 + level * 400),
    seamBlockThreshold: 8 + (1 - level) * 28,
  };
}

export function suppressFabricTexture(imageData, sensitivity) {
  const { blurRadius } = sensitivityToFabricParams(sensitivity);
  let result = separableBoxBlur(imageData, blurRadius);
  result = separableBoxBlur(result, blurRadius + 1);
  return result;
}
