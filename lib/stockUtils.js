import StockItem from "../models/stocks/StockItem";

export const getDividendArr = async (stockItemId) => {
  const stockItem = await StockItem.findById(stockItemId);
  console.log({ stockItem });
  if (!stockItem) {
    return [];
  }
  let dividendArr = [];
  if (stockItem?.level0?.uom && stockItem?.level0?.costPrice) {
    dividendArr.push({
      uom: stockItem?.level0?.uom,
      mFactor: 1,
    });
  }
  if (
    stockItem?.packagingStructure?.level1?.uom &&
    stockItem?.packagingStructure?.level1?.costPrice &&
    stockItem?.packagingStructure?.level1?.multiplier
  ) {
    dividendArr.push({
      uom: stockItem?.packagingStructure?.level1?.uom,
      mFactor: stockItem?.packagingStructure?.level1?.multiplier,
    });
  }
  if (
    stockItem?.packagingStructure?.level2?.uom &&
    stockItem?.packagingStructure?.level2?.costPrice &&
    stockItem?.packagingStructure?.level2?.multiplier
  ) {
    dividendArr.push({
      uom: stockItem?.packagingStructure?.level2?.uom,
      mFactor: stockItem?.packagingStructure?.level2?.multiplier,
    });
  }

  return dividendArr;
};

export const reduceQuantity = async (
  quantities,
  targetUom,
  targetQty,
  stockItemId,
) => {
  let dividendArr = await getDividendArr(stockItemId);

  console.log({ dividendArr, quantities, targetUom, targetQty, stockItemId });
  if (dividendArr.length === 0) return quantities;

  // Copy array
  let updated = JSON.parse(JSON.stringify(quantities));

  // Find target index
  const targetIndex = dividendArr.findIndex((d) => d.uom === targetUom);
  if (targetIndex === -1) throw new Error("UOM not found");

  // Find target item
  const targetItem = updated.find((d) => d.uom === targetUom);
  if (!targetItem) throw new Error("Target UOM not in quantities");

  // Check if enough in target
  if (targetItem.quantity < targetQty) {
    throw new Error(`Only ${targetItem.quantity} ${targetUom} available`);
  }

  // Sabse pehle target UOM se reduce karo
  targetItem.quantity -= targetQty;

  // Ab upar wale UOMs (higher index) ko adjust karo
  // Target se upar wale UOMs pe jao (chote index)
  for (let i = targetIndex - 1; i >= 0; i--) {
    const higherUom = dividendArr[i].uom;
    const higherItem = updated.find((d) => d.uom === higherUom);
    if (!higherItem) continue;

    // Calculate factor: target se higher tak ke saare mFactors multiply karo
    let factor = 1;
    for (let j = i + 1; j <= targetIndex; j++) {
      factor *= dividendArr[j].mFactor;
    }

    // Higher UOM me se proportional quantity subtract karo
    const reduceFromHigher = targetQty / factor;
    higherItem.quantity -= reduceFromHigher;

    // // Check negative nahi hona chahiye
    // if (higherItem.quantity < 0) {
    //   throw new Error(`Insufficient ${higherUom} after adjustment`);
    // }
  }

  // Ab neeche wale UOMs (lower index) ko adjust karo
  for (let i = targetIndex + 1; i < dividendArr.length; i++) {
    const lowerUom = dividendArr[i].uom;
    const lowerItem = updated.find((d) => d.uom === lowerUom);
    if (!lowerItem) continue;

    // Calculate factor: target se lower tak ke saare mFactors multiply karo
    let factor = 1;
    for (let j = targetIndex + 1; j <= i; j++) {
      factor *= dividendArr[j].mFactor;
    }

    // Lower UOM me se proportional quantity subtract karo
    const reduceFromLower = targetQty * factor;
    lowerItem.quantity -= reduceFromLower;

    // Check negative nahi hona chahiye
    if (lowerItem.quantity < 0) {
      throw new Error(`Insufficient ${lowerUom} after adjustment`);
    }
  }

  // Round all quantities to 2 decimal places before returning
  updated = updated.map((item) => ({
    ...item,
    quantity: Math.round(item.quantity * 100) / 100,
  }));

  // Check if any quantity is less than 0, if so set all quantities to 0
  const hasNegativeQuantity = updated.some((item) => item.quantity <= 0);
  if (hasNegativeQuantity) {
    updated = updated.map((item) => ({
      ...item,
      quantity: 0,
    }));
  }

  return updated;
};

export const calculateTotalAmount = async (
  stockItemId,
  targetUom,
  targetQty,
) => {
  const stockItem = await StockItem.findById(stockItemId);
  if (!stockItem) {
    throw new Error("Stock item not found");
  }
  if (stockItem?.level0?.uom === targetUom) {
    return stockItem?.level0?.costPrice * targetQty;
  }
  if (stockItem?.packagingStructure?.level1?.uom === targetUom) {
    return stockItem?.packagingStructure?.level1?.costPrice * targetQty;
  }
  if (stockItem?.packagingStructure?.level2?.uom === targetUom) {
    return stockItem?.packagingStructure?.level2?.costPrice * targetQty;
  }

  throw new Error("UOM not found");
};
