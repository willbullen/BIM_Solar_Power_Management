import { Express, Request, Response } from 'express';
import { fileService } from './services/file-service';
import multer from 'multer';
import path from 'path';

// Extend Request type to include userId property
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

// Configure multer for memory storage (we'll handle file saving ourselves)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Auth middleware
async function requireAuth(req: Request, res: Response, next: any) {
  // Check if user is authenticated via session
  const userId = req.session?.userId;
  
  // Check if user is authenticated via headers (for API calls)
  const headerUserId = req.headers['x-auth-user-id'];
  
  if (!userId && !headerUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Add userId to request for use in controllers
  req.userId = userId || Number(headerUserId);
  next();
}

export function registerFileRoutes(app: Express) {
  // Upload a file
  app.post('/api/files/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { 
        conversationId, 
        messageId, 
        isPublic = 'false'
      } = req.body;
      
      // Optional metadata as JSON
      let metadata = {};
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch (e) {
          console.warn('Invalid metadata JSON, using empty object instead');
        }
      }
      
      const fileAttachment = await fileService.saveFileAttachment(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        conversationId ? Number(conversationId) : undefined,
        messageId ? Number(messageId) : undefined,
        req.userId,
        isPublic === 'true',
        metadata
      );
      
      res.status(201).json(fileAttachment);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });
  
  // Download a file
  app.get('/api/files/:id/download', async (req: Request, res: Response) => {
    try {
      const fileId = Number(req.params.id);
      
      // Get file information
      const fileAttachment = await fileService.getFileAttachment(fileId);
      
      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if file is public or user is authorized
      const isPublic = fileAttachment.isPublic;
      const userId = req.session?.userId || req.headers['x-auth-user-id'] ? Number(req.headers['x-auth-user-id']) : undefined;
      
      if (!isPublic && userId) {
        // Check if user has access
        const canAccess = await fileService.canAccessFile(fileId, userId);
        if (!canAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (!isPublic && !userId) {
        return res.status(401).json({ error: 'Authentication required for non-public files' });
      }
      
      // Read file
      const { buffer, filename, fileType } = await fileService.readFile(fileId);
      
      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', fileType);
      
      // Send file
      res.send(buffer);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
  
  // Get file by ID
  app.get('/api/files/:id', async (req: Request, res: Response) => {
    try {
      const fileId = Number(req.params.id);
      
      // Get file information
      const fileAttachment = await fileService.getFileAttachment(fileId);
      
      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if file is public or user is authorized
      const isPublic = fileAttachment.isPublic;
      const userId = req.session?.userId || req.headers['x-auth-user-id'] ? Number(req.headers['x-auth-user-id']) : undefined;
      
      if (!isPublic && userId) {
        // Check if user has access
        const canAccess = await fileService.canAccessFile(fileId, userId);
        if (!canAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (!isPublic && !userId) {
        return res.status(401).json({ error: 'Authentication required for non-public files' });
      }
      
      res.json(fileAttachment);
    } catch (error) {
      console.error('Get file error:', error);
      res.status(500).json({ error: 'Failed to get file' });
    }
  });
  
  // Get files by conversation ID
  app.get('/api/files/conversation/:conversationId', requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = Number(req.params.conversationId);
      
      const files = await fileService.getFileAttachmentsByConversation(conversationId);
      
      res.json(files);
    } catch (error) {
      console.error('Get files by conversation error:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });
  
  // Get files by message ID
  app.get('/api/files/message/:messageId', requireAuth, async (req: Request, res: Response) => {
    try {
      const messageId = Number(req.params.messageId);
      
      const files = await fileService.getFileAttachmentsByMessage(messageId);
      
      res.json(files);
    } catch (error) {
      console.error('Get files by message error:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });
  
  // Delete a file
  app.delete('/api/files/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const fileId = Number(req.params.id);
      
      // Get file information
      const fileAttachment = await fileService.getFileAttachment(fileId);
      
      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if user is authorized to delete the file
      if (fileAttachment.createdBy !== req.userId) {
        // Only the owner can delete files (could add admin role check here)
        return res.status(403).json({ error: 'Not authorized to delete this file' });
      }
      
      // Delete file
      await fileService.deleteFileAttachment(fileId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });
}