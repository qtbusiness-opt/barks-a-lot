// The browser's client for this app's own /api routes.
//
// A thin wrapper over fetch that keeps the slice of axios's interface the
// pages were written against: api.get/post/patch/delete(path, body?)
// resolve to { status, data }, and a non-2xx answer rejects with an error
// whose .response carries { status, data } — so every
// `err.response?.data?.error` keeps working. axios itself was dropped: it
// only ever made same-origin JSON calls here, and a dependency that size
// is supply-chain exposure (it carried a stream of advisories) for
// nothing fetch doesn't already do.

// AuthContext registers a callback here rather than being imported
// directly — this module is imported *by* AuthContext, so the dependency
// has to point one way only.
let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(response) {
    super(`Request failed with status code ${response.status}`);
    this.name = "ApiError";
    this.response = response;
  }
}

// JSON when the body is JSON, the raw text otherwise (an HTML error page
// from a proxy, say), so callers reading data.error just get undefined.
function parseBody(text) {
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) {
    return { status: res.status, data: parseBody(await res.text()) };
  }
  const response = { status: res.status, data: parseBody(await res.text()) };

  // A stale session shows up as API calls failing while the UI still
  // looks signed in (the admin pages loading no data). Surface it
  // immediately instead of waiting for the next session refetch. 403 is
  // included because admin routes answer that way when the session no
  // longer resolves; the handler confirms the session is really gone
  // before tearing anything down, so a genuine permission error is left
  // alone.
  if ((res.status === 401 || res.status === 403) && onUnauthorized) {
    onUnauthorized();
  }
  throw new ApiError(response);
}

const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};

export default api;
