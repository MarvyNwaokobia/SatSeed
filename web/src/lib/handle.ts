/** Mirrors GardenRegistry: 3-32 chars of [a-z0-9_], not starting or ending with '_'. */
export function validateHandle(handle: string): string | null {
  if (handle.length < 3) return "Use at least 3 characters.";
  if (handle.length > 32) return "Use at most 32 characters.";
  if (!/^[a-z0-9_]+$/.test(handle)) return "Use only lowercase letters, numbers and underscores.";
  if (handle.startsWith("_") || handle.endsWith("_")) return "Can't start or end with an underscore.";
  return null;
}
