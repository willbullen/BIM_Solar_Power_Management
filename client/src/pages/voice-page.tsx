import React from 'react';
import { SharedLayout } from '@/components/ui/shared-layout';
import { VoiceTranscription } from '@/components/voice-transcription';
// Create a simple heading component directly in this file
const Heading = ({ title, description, icon }: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) => {
  return (
    <div className="flex items-start space-x-3">
      {icon && (
        <div className="mt-1 p-1.5 bg-primary/10 rounded-md text-primary">
          {icon}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};
import { Headphones } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function VoicePage() {
  const { user } = useAuth();

  return (
    <SharedLayout user={user}>
      <div className="container mx-auto py-6 space-y-6">
        <Heading 
          title="Voice Message Transcription & Translation" 
          description="Record or upload voice messages to transcribe and translate using AI"
          icon={<Headphones size={24} />}
        />
        
        <VoiceTranscription />
      </div>
    </SharedLayout>
  );
}