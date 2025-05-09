import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Local storage key for user data - must match the one in use-auth.tsx
const USER_STORAGE_KEY = 'emporium_user';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get the base URL for API requests
function getBaseUrl() {
  // In Replit, we need to use the window.location.origin
  return window.location.origin;
}

// Get authentication headers from local storage if available
function getAuthHeaders() {
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      return {
        'X-Auth-User-Id': user.id.toString(),
        'X-Auth-Username': user.username,
      };
    }
  } catch (e) {
    console.error('Failed to get auth headers from local storage:', e);
  }
  return {};
}

// New apiRequest format with options parameter
export async function apiRequest(
  url: string,
  options: { method: string; data?: unknown } | string,
  data?: unknown
): Promise<any> {
  // Handle both old and new formats
  let method: string;
  let requestData: unknown;
  
  if (typeof options === 'string') {
    // Old format: apiRequest(url, method, data)
    method = options;
    requestData = data;
  } else if (options && typeof options === 'object') {
    // New format: apiRequest(url, { method, data })
    method = options.method;
    requestData = options.data;
  } else {
    throw new Error('Invalid options format for API request');
  }
  
  // Ensure we have valid values
  if (!method || !url) {
    throw new Error('Method and URL are required for API requests');
  }
  
  // Ensure method is a valid HTTP method
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!validMethods.includes(method.toUpperCase())) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  
  // Ensure URL starts with a slash
  const apiUrl = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = `${getBaseUrl()}${apiUrl}`;
  
  // Add some logging to help debug the API calls
  console.log(`Making API request: ${method} ${fullUrl}`);
  
  // Setup request options
  const requestOptions: RequestInit = {
    method,
    headers: {
      ...(requestData && method !== 'GET' ? { "Content-Type": "application/json" } : {}),
      'Accept': 'application/json',
      ...getAuthHeaders(), // Add auth headers from local storage
    },
    credentials: "include", // Important for sending cookies with request
    mode: "cors",
    cache: "no-cache", // Prevent caching of requests
  };
  
  // Only add body for non-GET requests
  if (requestData && method !== 'GET') {
    requestOptions.body = JSON.stringify(requestData);
  }
  
  try {
    const res = await fetch(fullUrl, requestOptions);
    console.log(`API response status: ${res.status} ${res.statusText}`);
    
    // Handle authentication errors
    if (res.status === 401) {
      console.error('Authentication error detected in API request');
      // Invalidate the user query to force a refresh of auth state
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      throw new Error(`401: Authentication required. Please login again.`);
    }
    
    await throwIfResNotOk(res);
    
    // Parse JSON response
    try {
      const json = await res.json();
      return json;
    } catch (e) {
      // If no JSON content, return the response object
      return res;
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Format the URL correctly using the base URL
    const url = queryKey[0] as string;
    const apiUrl = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = `${getBaseUrl()}${apiUrl}`;
    
    console.log(`Making query request: GET ${fullUrl}`);
    
    try {
      const res = await fetch(fullUrl, {
        credentials: "include",
        mode: "cors",
        cache: "no-cache", // Prevent caching of requests
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders(), // Add auth headers from local storage
        },
      });
      
      console.log(`Query response status: ${res.status} ${res.statusText}`);
  
      if (res.status === 401) {
        console.log(`Auth error on ${url} - behavior: ${unauthorizedBehavior}`);
        
        if (unauthorizedBehavior === "returnNull") {
          console.log('Returning null for 401 response as configured');
          return null;
        }
        
        // For throw behavior, throw a clear authentication error
        console.error('Authentication error detected in query request');
        throw new Error(`401: Authentication required. Please login again.`);
      }
  
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error('Query request error:', error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
