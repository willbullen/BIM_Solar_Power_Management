import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

// New apiRequest format with explicit method, url, and data parameters
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<any> {
  // Ensure we have valid values
  if (!method || !url) {
    throw new Error('Method and URL are required for API requests');
  }
  
  // Ensure URL starts with a slash
  const apiUrl = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = `${getBaseUrl()}${apiUrl}`;
  
  // Add some logging to help debug the API calls
  console.log(`Making API request: ${method} ${fullUrl}`);
  
  // Setup request options
  const options: RequestInit = {
    method,
    headers: {
      ...(data && method !== 'GET' ? { "Content-Type": "application/json" } : {}),
      'Accept': 'application/json',
    },
    credentials: "include", // Important for sending cookies with request
    mode: "cors",
    cache: "no-cache", // Prevent caching of requests
  };
  
  // Only add body for non-GET requests
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  
  try {
    const res = await fetch(fullUrl, options);
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
