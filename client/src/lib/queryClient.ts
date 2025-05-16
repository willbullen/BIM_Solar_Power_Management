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
      
      // Make sure we have both required fields for authentication
      if (!user.id || !user.username) {
        console.error('Invalid user data in local storage, missing id or username');
        // Attempt to clean up corrupted data
        localStorage.removeItem(USER_STORAGE_KEY);
        return {};
      }
      
      console.log(`Using auth headers for user ID: ${user.id}`);
      return {
        'X-Auth-User-Id': user.id.toString(),
        'X-Auth-Username': user.username,
      };
    } else {
      console.log('No user data found in local storage for auth headers');
    }
  } catch (e) {
    console.error('Failed to get auth headers from local storage:', e);
    // Attempt to clean up corrupted data
    localStorage.removeItem(USER_STORAGE_KEY);
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
  
  // Get auth headers from local storage
  const authHeaders = getAuthHeaders();
  
  // Setup request options with proper headers
  const requestOptions: RequestInit = {
    method,
    headers: {
      ...(requestData && method !== 'GET' ? { "Content-Type": "application/json" } : {}),
      'Accept': 'application/json',
      ...authHeaders,
    },
    credentials: "include", // Important for sending cookies with request
    mode: "cors",
    cache: "no-cache", // Prevent caching of requests
  };
  
  // Log authentication information for debug (don't log in production)
  if (Object.keys(authHeaders).length > 0) {
    console.log(`Request has auth headers: ${Object.keys(authHeaders).join(', ')}`);
  } else {
    console.log('No auth headers present in request');
  }
  
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
      
      // Check if this is a login/register endpoint
      const isAuthEndpoint = url.includes('/login') || url.includes('/register');
      
      if (!isAuthEndpoint) {
        // Invalidate the user query to force a refresh of auth state
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        throw new Error(`401: Authentication required. Please login again.`);
      }
      
      // For auth endpoints, let the specific error come through
      const errorText = await res.text();
      throw new Error(errorText || 'Authentication failed');
    }
    
    // For non-401 errors
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error response (${res.status}):`, errorText);
      throw new Error(errorText || res.statusText || `Error: ${res.status}`);
    }
    
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
    
    // Special logging for langchain agents
    const isLangchainAgentsRequest = url.includes('langchain/agents');
    if (isLangchainAgentsRequest) {
      console.log("LANGCHAIN AGENTS REQUEST FOUND - debugging request details");
    }
    
    // Get auth headers from local storage
    const authHeaders = getAuthHeaders();
    
    // Log authentication information for debug (don't log in production)
    if (Object.keys(authHeaders).length > 0) {
      console.log(`Query has auth headers: ${Object.keys(authHeaders).join(', ')}`);
      
      // Extra validation for langchain requests
      if (isLangchainAgentsRequest) {
        console.log("LANGCHAIN AUTH HEADERS:", authHeaders);
      }
    } else {
      console.log('No auth headers present in query');
      
      if (isLangchainAgentsRequest) {
        console.log("WARNING: NO AUTH HEADERS FOR LANGCHAIN REQUEST!");
      }
    }
    
    try {
      const res = await fetch(fullUrl, {
        credentials: "include", // Include cookies for session auth
        mode: "cors",
        cache: "no-cache", // Prevent caching of requests
        headers: {
          'Accept': 'application/json',
          ...authHeaders, // Add auth headers from local storage
        },
      });
      
      console.log(`Query response status: ${res.status} ${res.statusText}`);
      
      // Special handling for Langchain agents response
      if (isLangchainAgentsRequest) {
        console.log("LANGCHAIN AGENTS RESPONSE HEADERS:", Object.fromEntries([...res.headers.entries()]));
        
        // Clone the response so we can read the body multiple times
        const clonedResponse = res.clone();
        
        // Try to parse the body as JSON for debug
        try {
          const debugText = await clonedResponse.text();
          console.log("LANGCHAIN AGENTS RAW RESPONSE:", debugText);
          
          try {
            const debugJson = JSON.parse(debugText);
            console.log("LANGCHAIN AGENTS JSON RESPONSE:", debugJson);
            
            // Check the enabled field status for each agent
            if (Array.isArray(debugJson)) {
              debugJson.forEach((agent, i) => {
                console.log(`AGENT ${i+1}: ${agent.name}, enabled=${agent.enabled}, type=${typeof agent.enabled}`);
              });
            }
          } catch (e) {
            console.error("Failed to parse response as JSON:", e);
          }
        } catch (e) {
          console.error("Failed to read response body:", e);
        }
      }
  
      if (res.status === 401) {
        // Get the URL without query parameters for better logging
        const baseUrl = url.split('?')[0];
        console.log(`Auth error on ${baseUrl} - behavior: ${unauthorizedBehavior}`);
        
        // Special case for Telegram API endpoints - don't force logout on these paths
        const isTelegramEndpoint = url.includes('/api/telegram/');
        
        if (isTelegramEndpoint) {
          console.log('Telegram endpoint detected, suppressing authentication error');
          // For Telegram endpoints, always return null rather than forcing logout
          return null;
        }
        
        if (unauthorizedBehavior === "returnNull") {
          console.log('Returning null for 401 response as configured');
          return null;
        }
        
        // For throw behavior, throw a clear authentication error
        console.error('Authentication error detected in query request');
        
        // Try to parse the error message
        try {
          const errorText = await res.text();
          throw new Error(errorText || `401: Authentication required. Please login again.`);
        } catch (e) {
          throw new Error(`401: Authentication required. Please login again.`);
        }
      }
  
      // For non-401 errors
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error response (${res.status}) for query:`, errorText);
        throw new Error(errorText || res.statusText || `Error: ${res.status}`);
      }
      
      // Parse JSON response
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
