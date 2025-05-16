import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

// Local storage key for user data
const USER_STORAGE_KEY = 'emporium_user';

// Helper functions for local storage
const saveUserToLocalStorage = (user: SelectUser) => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    console.log('User saved to local storage:', user.id);
  } catch (e) {
    console.error('Failed to save user to local storage:', e);
  }
};

const getUserFromLocalStorage = (): SelectUser | null => {
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    if (userData) {
      console.log('Found user in local storage');
      return JSON.parse(userData);
    }
    return null;
  } catch (e) {
    console.error('Failed to get user from local storage:', e);
    return null;
  }
};

const clearUserFromLocalStorage = () => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    console.log('User cleared from local storage');
  } catch (e) {
    console.error('Failed to clear user from local storage:', e);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Use local storage as initial data
  const localUser = getUserFromLocalStorage();
  
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    initialData: localUser,
  });

  // If we have a user in local storage but no server session, try to sync
  useEffect(() => {
    const attemptSessionSync = async () => {
      // If we have local user but server says not authenticated
      if (localUser && !user) {
        console.log('Session mismatch - attempting to restore from local storage');
        
        try {
          // Attempt a special login with just the ID to restore the session
          // Use the options object format
          const result = await apiRequest('/api/session/restore', {
            method: 'POST',
            data: { 
              userId: localUser.id,
              username: localUser.username
            }
          });
          
          if (result) {
            console.log('Session restored');
            refetch();
          } else {
            // If session restore fails, try to force a regular login
            console.log('Session restore failed, attempting login with stored credentials');
            
            // Force refresh the auth headers to ensure they're correct
            if (localUser && localUser.username) {
              // Update localStorage again to ensure proper headers
              saveUserToLocalStorage(localUser);
              
              // Redirect to login page if we can't restore the session
              console.log('Redirecting to login page due to authentication issues');
              setLocation("/login");
            }
          }
        } catch (err) {
          console.log('Failed to restore session', err);
          // Clear possibly corrupted user data from local storage
          if (err.message?.includes('401') || err.message?.includes('authentication')) {
            console.log('Authentication error detected, clearing local storage');
            clearUserFromLocalStorage();
            setLocation("/login");
          }
        }
      }
    };
    
    attemptSessionSync();
  }, [localUser, user, refetch, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        console.log('Login attempt for user:', credentials.username);
        // Use the options object format for apiRequest
        const response = await apiRequest("/api/login", {
          method: "POST",
          data: credentials
        });
        console.log('Login response:', response);
        return response;
      } catch (error) {
        console.error('Login mutation error:', error);
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log('Login successful for user:', user.username);
      queryClient.setQueryData(["/api/user"], user);
      saveUserToLocalStorage(user);
      
      // Force a refresh of the user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Navigate to dashboard
      setLocation("/dashboard");
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error('Login error in mutation:', error);
      toast({
        title: "Login failed",
        description: error.message || "Authentication failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      try {
        console.log('Registration attempt for user:', credentials.username);
        // Ensure correct parameter order - apiRequest(url, method, data)
        const response = await apiRequest("/api/register", "POST", credentials);
        console.log('Registration response:', response);
        return response;
      } catch (error) {
        console.error('Registration mutation error:', error);
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log('Registration successful for user:', user.username);
      queryClient.setQueryData(["/api/user"], user);
      saveUserToLocalStorage(user);
      
      // Force a refresh of the user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Navigate to dashboard
      setLocation("/dashboard");
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error('Registration error in mutation:', error);
      toast({
        title: "Registration failed",
        description: error.message || "Registration failed. Please try a different username.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Use the options object format for apiRequest
      return apiRequest("/api/logout", {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      clearUserFromLocalStorage();
      setLocation("/auth");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: (error: Error) => {
      // Even if server logout fails, clear local state
      queryClient.setQueryData(["/api/user"], null);
      clearUserFromLocalStorage();
      setLocation("/auth");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
        variant: "default",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
