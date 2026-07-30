export function validTransferPrice(price: number, transferPrice?: number | null) {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!transferPrice || !Number.isFinite(transferPrice) || transferPrice <= 0) return null;

  return transferPrice < price ? transferPrice : null;
}

export function bestAvailablePrice(price: number, transferPrice?: number | null) {
  return validTransferPrice(price, transferPrice) ?? price;
}
