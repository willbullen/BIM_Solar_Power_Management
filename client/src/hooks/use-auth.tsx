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
          const result = await apiRequest('POST', '/api/session/restore', { 
            userId: localUser.id,
            username: localUser.username
          });
          
          if (result) {
            console.log('Session restored');
            refetch();
          }
        } catch (err) {
          console.log('Failed to restore session', err);
        }
      }
    };
    
    attemptSessionSync();
  }, [localUser, user, refetch]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      return apiRequest('POST', "/api/login", credentials);
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      saveUserToLocalStorage(user);
      setLocation("/dashboard");
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      return apiRequest("POST", "/api/register", credentials);
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      saveUserToLocalStorage(user);
      setLocation("/dashboard");
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/logout");
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
