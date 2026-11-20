// small helper for calling the backend from the phase 2 pages.
// adds the login token, sends/reads JSON, and throws an Error with the
// backend's message ({ error: "..." }) so pages can just show err.message.
// an expired/missing login sends you back to the login page.

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 401 || res.status === 422) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Please sign in again.')
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error || `Something went wrong (${res.status}).`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export function currentUser() {
  return JSON.parse(localStorage.getItem('user') || 'null')
}
