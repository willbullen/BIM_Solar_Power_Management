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

// Handle both 1-arg and 3-arg formats:
// apiRequest(url) - for GET requests
// apiRequest(method, url, data) - for other methods
export async function apiRequest(
  methodOrUrl: string,
  urlOrData?: string | unknown,
  data?: unknown
): Promise<any> {
  let method: string;
  let url: string;
  let requestData: unknown | undefined;
  
  // Determine which form was used
  if (arguments.length === 1 || (arguments.length > 1 && typeof urlOrData !== 'string')) {
    // Called as apiRequest(url) or apiRequest(url, data)
    method = 'GET';
    url = methodOrUrl;
    requestData = urlOrData;
  } else {
    // Called as apiRequest(method, url, data)
    method = methodOrUrl;
    url = urlOrData as string;
    requestData = data;
  }
  
  // Ensure URL starts with a slash
  const apiUrl = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = `${getBaseUrl()}${apiUrl}`;
  
  // Add some logging to help debug the API calls
  console.log(`Making API request: ${method} ${fullUrl}`);
  
  const res = await fetch(fullUrl, {
    method,
    headers: requestData ? { "Content-Type": "application/json" } : {},
    body: requestData ? JSON.stringify(requestData) : undefined,
    credentials: "include",
  });

  console.log(`API response status: ${res.status} ${res.statusText}`);
  
  await throwIfResNotOk(res);
  
  // Parse JSON response
  try {
    const json = await res.json();
    return json;
  } catch (e) {
    // If no JSON content, return the response object
    return res;
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
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });
    
    console.log(`Query response status: ${res.status} ${res.statusText}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log('Returning null for 401 response as configured');
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
