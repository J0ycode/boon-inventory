/**
 * Generated RPC types mark every parameter without a SQL default as non-nullable, although our functions accept
 * NULL for "none" (e.g. p_id = null → create). This sends a real JSON null while satisfying the type.
 */
export function orNull<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
