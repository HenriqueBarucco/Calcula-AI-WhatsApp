export function isMessageFromAllowedGroup(
  messageGroup: string | undefined | null,
  allowedGroup: string | null,
): boolean {
  if (!allowedGroup) return true
  return messageGroup === allowedGroup
}

export function getAllowedGroup(
  getter: (key: string) => string | undefined,
): string | null {
  return getter('GROUP') || null
}
