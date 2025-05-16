import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mic, StopCircle, Upload, Trash2, RefreshCw, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

// Language options for translation
const languageOptions = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
];

interface Transcription {
  id: number;
  originalText: string;
  translatedText: string | null;
  sourceLanguage: string;
  targetLanguage: string | null;
  audioFilePath: string;
  duration: number;
  createdAt: string;
}

export function VoiceTranscription() {
  const { user } = useAuth();
  // We use the imported queryClient to avoid duplicate declarations
// const queryClient = useQueryClient();
  
  // State for recording and file
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  // Query for fetching transcription history
  const {
    data: transcriptionHistory = [] as Transcription[],
    isLoading: isLoadingHistory,
    refetch: refetchHistory
  } = useQuery<Transcription[]>({
    queryKey: ['/api/voice/history'],
    enabled: !!user,
  });
  
  // Mutation for transcribing audio
  const transcribeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/voice/transcribe', {
        method: 'POST',
        data: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Transcription successful',
        description: 'Your voice message has been transcribed.',
      });
      setAudioFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/voice/history'] });
      setIsTranscribing(false);
    },
    onError: (error) => {
      console.error('Transcription error:', error);
      toast({
        title: 'Transcription failed',
        description: 'There was an error processing your voice message.',
        variant: 'destructive',
      });
      setIsTranscribing(false);
    }
  });
  
  // Mutation for deleting transcription
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/voice/transcription/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Transcription deleted',
        description: 'The transcription has been removed.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/voice/history'] });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete the transcription.',
        variant: 'destructive',
      });
    }
  });
  
  // Function to start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Create new media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // Create file from blob
        const file = new File([audioBlob], `recording-${Date.now()}.wav`, {
          type: 'audio/wav',
        });
        
        setAudioFile(file);
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      let seconds = 0;
      timerRef.current = window.setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording error',
        description: 'Could not access microphone. Please check your browser permissions.',
        variant: 'destructive',
      });
    }
  };
  
  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  
  // Function to handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file is audio
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an audio file.',
          variant: 'destructive',
        });
        return;
      }
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Audio file must be less than 10MB.',
          variant: 'destructive',
        });
        return;
      }
      
      setAudioFile(file);
    }
  };
  
  // Function to handle transcription
  const handleTranscribe = async () => {
    if (!audioFile) {
      toast({
        title: 'No audio file',
        description: 'Please record or upload an audio file first.',
        variant: 'destructive',
      });
      return;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('language', sourceLanguage);
    formData.append('targetLanguage', targetLanguage);
    
    setIsTranscribing(true);
    transcribeMutation.mutate(formData);
  };
  
  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice Message Transcription</CardTitle>
          <CardDescription>
            Record or upload a voice message to transcribe and translate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Source language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Target language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              {isRecording ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={stopRecording}
                    className="flex items-center space-x-2"
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>Stop Recording ({formatTime(recordingTime)})</span>
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={startRecording}
                  className="flex items-center space-x-2"
                  disabled={!!audioFile || isTranscribing}
                >
                  <Mic className="h-4 w-4" />
                  <span>Record Voice</span>
                </Button>
              )}
              
              <div className="relative">
                <Input
                  type="file"
                  id="audio-upload"
                  accept="audio/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  disabled={isRecording || isTranscribing}
                />
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  disabled={isRecording || isTranscribing}
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Audio</span>
                </Button>
              </div>
            </div>
            
            {audioFile && (
              <div className="flex flex-col space-y-2">
                <div className="text-sm font-medium">
                  Selected file: {audioFile.name}
                </div>
                <audio controls src={URL.createObjectURL(audioFile)} className="w-full" />
                <Button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="flex items-center space-x-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      <span>Transcribe & Translate</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transcription History</CardTitle>
            <CardDescription>
              Your recent voice transcriptions
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchHistory()}
            disabled={isLoadingHistory}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : transcriptionHistory.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No transcriptions found. Record or upload a voice message to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {transcriptionHistory.map((item: Transcription) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          From: {languageOptions.find(l => l.value === item.sourceLanguage)?.label || item.sourceLanguage}
                          {item.targetLanguage && item.targetLanguage !== item.sourceLanguage && (
                            <> → {languageOptions.find(l => l.value === item.targetLanguage)?.label || item.targetLanguage}</>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="text-sm font-medium">Original:</div>
                    <div className="bg-muted p-2 rounded text-sm mb-2">{item.originalText}</div>
                    
                    {item.translatedText && item.translatedText !== item.originalText && (
                      <>
                        <div className="text-sm font-medium">Translation:</div>
                        <div className="bg-muted p-2 rounded text-sm">{item.translatedText}</div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}