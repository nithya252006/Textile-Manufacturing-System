export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getAuthToken = () => localStorage.getItem('everest-token');

export const authFetch = async (url, options = {}) => {
	const token = getAuthToken();
	const headers = { ...(options.headers || {}) };

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) {
		headers['Content-Type'] = 'application/json';
	}

	return fetch(url, { ...options, headers });
};

export default API_BASE;
