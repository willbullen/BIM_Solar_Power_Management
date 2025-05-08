import { Helmet } from 'react-helmet';
import AIAgentChat from '@/components/ai-agent-chat';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

export default function AgentPage() {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect if not authenticated
  const [, setLocation] = useLocation();
  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <>
      <Helmet>
        <title>AI Agent - Emporium Energy</title>
      </Helmet>

      <div className="container flex h-[calc(100vh-4rem)] flex-col py-6">
        <Card className="flex h-full flex-col overflow-hidden">
          <AIAgentChat />
        </Card>
      </div>
    </>
  );
}