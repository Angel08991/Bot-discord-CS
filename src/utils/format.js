export function replaceVariables(text, { user, membercount, server, username, channel, level = 0, xp = 0, rank = 0, reason = '' } = {}) {
  return String(text ?? '')
    .replaceAll('{user}', user ?? '')
    .replaceAll('{username}', username ?? '')
    .replaceAll('{server}', server ?? '')
    .replaceAll('{membercount}', String(membercount ?? ''))
    .replaceAll('{channel}', channel ?? '')
    .replaceAll('{level}', String(level))
    .replaceAll('{xp}', String(xp))
    .replaceAll('{rank}', String(rank))
    .replaceAll('{reason}', reason ?? '');
}

export function parseColor(input, fallback = 0x8B5CF6) {
  if (typeof input !== 'string') return fallback;
  const value = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return fallback;
  return Number.parseInt(value, 16);
}
