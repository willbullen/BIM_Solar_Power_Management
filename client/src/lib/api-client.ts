/**
 * Utility functions for making authenticated API requests
 */

/**
 * Make an authenticated API request
 * @param url The URL to fetch from
 * @param options Additional fetch options
 * @returns The fetch response
 */
export async function apiRequest(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  // Ensure URL has correct origin
  const fullUrl = url.startsWith('http') 
    ? url 
    : `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
  
  // Set up default options including credentials
  const defaultOptions: RequestInit = {
    credentials: "include",
    mode: "cors",
    cache: "no-cache",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };
  
  // Merge default options with provided options
  const fetchOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {}),
    },
  };
  
  return fetch(fullUrl, fetchOptions);
}

/**
 * Make an authenticated GET request
 * @param url The URL to fetch from
 * @param options Additional fetch options
 * @returns The fetch response parsed as JSON
 */
export async function apiGet<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(url, {
    method: 'GET',
    ...options,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch (e) {
      // Use the raw text if it can't be parsed as JSON
      if (errorText) errorMessage = errorText;
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * Make an authenticated POST request
 * @param url The URL to fetch from
 * @param data The data to send
 * @param options Additional fetch options
 * @returns The fetch response parsed as JSON
 */
export async function apiPost<T = any>(
  url: string, 
  data: any,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch (e) {
      // Use the raw text if it can't be parsed as JSON
      if (errorText) errorMessage = errorText;
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}