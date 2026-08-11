import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// AuthContext registers a callback here rather than being imported
// directly — api.js is imported *by* AuthContext, so the dependency has
// to point one way only.
let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// A stale session shows up as API calls failing while the UI still looks
// signed in (the admin pages loading no data). Surface it immediately
// instead of waiting for the next session refetch. 403 is included
// because admin routes answer that way when the session no longer
// resolves; the handler confirms the session is really gone before
// tearing anything down, so a genuine permission error is left alone.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
