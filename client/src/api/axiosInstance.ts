// What it does: pre-configured axios client with base URL, credentials, and auth header interceptor
import axios from "axios";
import useAuthStore from "../store/useAuthStore";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // 401 error - not autheticated, redirect to login apge
      useAuthStore.getState().logout();
      window.location.href = "/login";
    } else if (status === 403) {
      // 403 error - not authrorized, redirect to forbidden page
      window.location.href = "/forbidden";
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
