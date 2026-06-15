const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const api = {
  get: (path) => fetch(`${BASE}/api${path}`, { headers: getHeaders() }).then(handleResponse),
  post: (path, body) => fetch(`${BASE}/api${path}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),
  put: (path, body) => fetch(`${BASE}/api${path}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),
  patch: (path, body) => fetch(`${BASE}/api${path}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),
  delete: (path) => fetch(`${BASE}/api${path}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
  upload: (path, formData) => fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: formData
  }).then(handleResponse)
};

export default api;
