/**
 * Voice Message Transcription and Translation Routes
 * 
 * This file contains API routes for handling voice message processing:
 * - Audio file upload
 * - Transcription using OpenAI Whisper
 * - Translation to different languages
 */

import { Express, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import OpenAI from 'openai';
import { storage } from './storage';
import { authenticateUser } from './auth';

// Initialize OpenAI with API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Set up multer for file storage
const uploadDir = path.join(process.cwd(), 'uploads', 'voice');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage_engine = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

// File filter to only allow audio files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept audio files
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'));
  }
};

// Configure upload limits
const upload = multer({
  storage: storage_engine,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Voice message schema
const transcriptionRequestSchema = z.object({
  language: z.string().optional(), // Source language (optional, for better accuracy)
  targetLanguage: z.string().optional(), // Target language for translation
  userId: z.number().optional() // User ID for storing in database
});

// Register voice routes
export function registerVoiceRoutes(app: Express) {
  // Upload and transcribe voice message
  app.post('/api/voice/transcribe', authenticateUser, upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      // Parse request parameters
      const params = transcriptionRequestSchema.parse({
        language: req.body.language,
        targetLanguage: req.body.targetLanguage,
        userId: req.user?.id // Get user ID from auth middleware
      });

      // Path to the uploaded file
      const filePath = req.file.path;

      // Use OpenAI Whisper for transcription
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        language: params.language
      });

      let translatedText = transcription.text;
      let originalText = transcription.text;

      // If target language is provided and different from source, translate
      if (params.targetLanguage && params.targetLanguage !== params.language) {
        // Use OpenAI for translation
        const translation = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system", 
              content: `You are a professional translator. Translate the following text to ${params.targetLanguage}. 
                        Preserve all formatting, punctuation, and tone. Return only the translated text without
                        any explanations or notes.`
            },
            {
              role: "user",
              content: transcription.text
            }
          ],
          temperature: 0.3 // Lower temperature for more accurate translations
        });

        translatedText = translation.choices[0].message.content?.trim() || transcription.text;
      }

      // Store transcription in database if configured
      const transcriptionRecord = await storage.createVoiceTranscription({
        userId: params.userId || 0,
        originalText: originalText,
        translatedText: translatedText,
        sourceLanguage: params.language || 'auto',
        targetLanguage: params.targetLanguage || params.language || 'auto',
        audioFilePath: req.file.filename,
        duration: 0, // Will be updated if available
        createdAt: new Date()
      });

      // Return results
      res.json({
        success: true,
        transcription: {
          original: originalText,
          translated: translatedText,
          sourceLanguage: params.language || 'auto-detected',
          targetLanguage: params.targetLanguage || params.language || 'auto-detected',
          id: transcriptionRecord.id
        }
      });

      // Cleanup: remove the audio file after processing if not needed
      // Uncomment if you don't want to keep the uploaded files
      // fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error processing voice message:', error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
      }
      
      // Handle other errors
      res.status(500).json({ 
        error: 'Failed to process voice message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Retrieve transcription history
  app.get('/api/voice/history', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const history = await storage.getVoiceTranscriptions(userId);
      res.json({ success: true, history });
    } catch (error) {
      console.error('Error retrieving voice transcription history:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve transcription history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a transcription
  app.delete('/api/voice/transcription/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      if (isNaN(transcriptionId)) {
        return res.status(400).json({ error: 'Invalid transcription ID' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Delete the transcription
      const result = await storage.deleteVoiceTranscription(transcriptionId, userId);
      if (!result) {
        return res.status(404).json({ error: 'Transcription not found or user not authorized' });
      }

      res.json({ success: true, message: 'Transcription deleted successfully' });
    } catch (error) {
      console.error('Error deleting transcription:', error);
      res.status(500).json({ 
        error: 'Failed to delete transcription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}