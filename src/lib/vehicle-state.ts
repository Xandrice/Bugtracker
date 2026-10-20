export function numericVehicleState(value: unknown): number | null {
  return typeof value === "number" || (typeof value === "string" && /^[012]$/.test(value)) ? Number(value) : null;
}
export function vehicleStoredState(value: unknown): boolean | null {
  const state = numericVehicleState(value);
  return state === 1 ? true : state === 0 ? false : null;
}
