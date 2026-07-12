import { buildCombinedYardageReport } from '../yardageCalculator';

function groupCellsByFabricKey(cellColors, cellFabricIds) {
  const groups = new Map();

  cellColors.forEach((color, index) => {
    if (!color) {
      return;
    }

    const fabricId = cellFabricIds?.[index] ?? null;
    const key = fabricId || color.toLowerCase();
    const existing = groups.get(key) ?? {
      key,
      fabricId,
      color: color.toLowerCase(),
      cellCount: 0,
    };
    existing.cellCount += 1;
    groups.set(key, existing);
  });

  return groups;
}

export function buildFabricPricingReport({
  frontCellColors,
  frontCellFabricIds,
  frontCellColorsB,
  frontCellDiagonals,
  frontMerges,
  backCellColors,
  backCellFabricIds,
  backCellColorsB,
  backCellDiagonals,
  backMerges,
  quiltWidth,
  quiltHeight,
  columns,
  rows,
  seamAllowance,
  fabricCatalog,
}) {
  const yardageReport = buildCombinedYardageReport(
    frontCellColors,
    frontMerges,
    backCellColors,
    backMerges,
    quiltWidth,
    quiltHeight,
    columns,
    rows,
    seamAllowance,
    {
      frontCellColorsB,
      frontCellDiagonals,
      backCellColorsB,
      backCellDiagonals,
    }
  );

  const frontGroups = groupCellsByFabricKey(frontCellColors, frontCellFabricIds);
  const backGroups = groupCellsByFabricKey(backCellColors, backCellFabricIds);

  const fabricLines = [];
  let totalFabricCost = 0;

  yardageReport.colors.forEach((colorRow) => {
    const color = colorRow.color.toLowerCase();
    const fabricKeys = [
      ...[...frontGroups.values(), ...backGroups.values()].filter(
        (group) => group.color === color && group.fabricId
      ),
    ];

    const uniqueFabricIds = [...new Set(fabricKeys.map((group) => group.fabricId))];
    if (!uniqueFabricIds.length) {
      return;
    }

    const cellsForColor =
      [...frontGroups.values(), ...backGroups.values()]
        .filter((group) => group.color === color)
        .reduce((sum, group) => sum + group.cellCount, 0) || 1;

    uniqueFabricIds.forEach((fabricId) => {
      const fabric = fabricCatalog[fabricId];
      if (!fabric) {
        return;
      }

      const fabricCells = [...frontGroups.values(), ...backGroups.values()]
        .filter((group) => group.fabricId === fabricId && group.color === color)
        .reduce((sum, group) => sum + group.cellCount, 0);

      const yardsShare = colorRow.yards * (fabricCells / cellsForColor);
      const cost = yardsShare * fabric.pricePerYard;
      totalFabricCost += cost;

      fabricLines.push({
        fabricId,
        name: fabric.name,
        storeName: fabric.storeName,
        color: fabric.primaryColor,
        yards: yardsShare,
        pricePerYard: fabric.pricePerYard,
        cost,
        imageUrl: fabric.imageUrl,
      });
    });
  });

  return {
    yardageReport,
    fabricLines: fabricLines.sort((a, b) => b.cost - a.cost),
    totalFabricCost,
  };
}

export function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
