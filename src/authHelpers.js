/** Email nội bộ — Supabase Auth bắt buộc có email, UI chỉ hiện username */
const USERNAME_EMAIL_DOMAIN = "timetable.local"

export function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

export function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(username))
}

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}

export function getDisplayUsername(user) {
  if (!user) return ""

  const fromMeta = user.user_metadata?.username
  if (fromMeta) return String(fromMeta)

  const email = user.email || ""
  if (email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`)) {
    return email.slice(0, -(USERNAME_EMAIL_DOMAIN.length + 1))
  }

  return email
}
