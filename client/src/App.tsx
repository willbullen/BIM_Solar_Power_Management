import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch settings using a regular fetch call instead of react-query
    // This helps us isolate issues with react-query vs general fetching
    fetch('/api/settings')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Settings data received:', data);
        setSettings(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error fetching settings:', err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Emporium Power Monitoring Dashboard</h1>
        <div className="bg-white p-4 rounded shadow mb-4">
          <h2 className="text-xl font-bold mb-2">API Connection Test</h2>
          
          {isLoading ? (
            <p className="text-blue-600">Loading settings data...</p>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="font-bold">Error fetching settings:</p>
              <p>{error}</p>
            </div>
          ) : (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-bold">✓ API is working!</p>
              <p>Settings data successfully retrieved.</p>
              <pre className="bg-gray-100 p-2 mt-2 rounded overflow-auto max-h-40">
                {JSON.stringify(settings, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
