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

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Ensure URL starts with a slash
  const apiUrl = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = `${getBaseUrl()}${apiUrl}`;
  
  // Add some logging to help debug the API calls
  console.log(`Making API request: ${method} ${fullUrl}`);
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log(`API response status: ${res.status} ${res.statusText}`);
  
  await throwIfResNotOk(res);
  return res;
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
