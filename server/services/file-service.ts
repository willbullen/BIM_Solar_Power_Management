import { db } from '../db';
import { fileAttachments, type FileAttachment, type InsertFileAttachment } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

// Promisify file system operations
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

export class FileService {
  private uploadDir: string;
  
  constructor() {
    // Set upload directory
    this.uploadDir = path.join(process.cwd(), 'uploads');
    
    // Create upload directory if it doesn't exist
    this.ensureUploadDir();
  }
  
  /**
   * Ensure the upload directory exists
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      if (!await exists(this.uploadDir)) {
        await mkdir(this.uploadDir, { recursive: true });
        console.log(`Created upload directory at ${this.uploadDir}`);
      }
    } catch (error) {
      console.error('Error creating upload directory:', error);
      throw new Error('Failed to create upload directory');
    }
  }
  
  /**
   * Generate a unique filename
   */
  private generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename);
    const sanitizedName = path.basename(originalFilename, extension)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 20);
    
    return `${sanitizedName}_${timestamp}_${randomString}${extension}`;
  }
  
  /**
   * Save a file to the filesystem
   */
  private async saveFile(buffer: Buffer, filename: string): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);
    await writeFile(filePath, buffer);
    return filePath;
  }
  
  /**
   * Save a file attachment
   */
  async saveFileAttachment(
    buffer: Buffer, 
    originalFilename: string, 
    fileType: string,
    conversationId?: number,
    messageId?: number,
    createdBy?: number,
    isPublic: boolean = false,
    metadata: any = {}
  ): Promise<FileAttachment> {
    try {
      // Generate unique filename
      const filename = this.generateUniqueFilename(originalFilename);
      
      // Save file to filesystem
      const filePath = await this.saveFile(buffer, filename);
      
      // Create database record
      const fileAttachment: InsertFileAttachment = {
        conversationId,
        messageId,
        filename,
        originalFilename,
        fileType,
        filePath: path.relative(process.cwd(), filePath),
        fileSize: buffer.length,
        isPublic,
        createdBy,
        metadata: metadata ? JSON.stringify(metadata) : JSON.stringify({}),
      };
      
      // Insert into database
      const [result] = await db.insert(fileAttachments).values(fileAttachment).returning();
      
      return result;
    } catch (error) {
      console.error('Error saving file attachment:', error);
      throw new Error('Failed to save file attachment');
    }
  }
  
  /**
   * Get a file attachment by ID
   */
  async getFileAttachment(id: number): Promise<FileAttachment | undefined> {
    try {
      const [file] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id));
      return file;
    } catch (error) {
      console.error('Error getting file attachment:', error);
      throw new Error('Failed to get file attachment');
    }
  }
  
  /**
   * Get file attachments by conversation ID
   */
  async getFileAttachmentsByConversation(conversationId: number): Promise<FileAttachment[]> {
    try {
      // Validate the conversation ID
      if (!conversationId || isNaN(conversationId)) {
        console.error('Invalid conversation ID:', conversationId);
        return []; // Return empty array instead of throwing to prevent 500 errors
      }
      
      const files = await db.select().from(fileAttachments).where(eq(fileAttachments.conversationId, conversationId));
      return files || []; // Return empty array if null
    } catch (error) {
      console.error('Error getting file attachments by conversation:', error);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }
  
  /**
   * Get file attachments by message ID
   */
  async getFileAttachmentsByMessage(messageId: number): Promise<FileAttachment[]> {
    try {
      // Validate the message ID
      if (!messageId || isNaN(messageId)) {
        console.error('Invalid message ID:', messageId);
        return []; // Return empty array instead of throwing to prevent 500 errors
      }
      
      const files = await db.select().from(fileAttachments).where(eq(fileAttachments.messageId, messageId));
      return files || []; // Return empty array if null
    } catch (error) {
      console.error('Error getting file attachments by message:', error);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }
  
  /**
   * Read a file by file attachment ID
   */
  async readFile(fileAttachmentId: number): Promise<{ buffer: Buffer, filename: string, fileType: string }> {
    try {
      const file = await this.getFileAttachment(fileAttachmentId);
      
      if (!file) {
        throw new Error('File attachment not found');
      }
      
      const filePath = path.join(process.cwd(), file.filePath);
      const buffer = await readFile(filePath);
      
      return {
        buffer,
        filename: file.originalFilename,
        fileType: file.fileType
      };
    } catch (error) {
      console.error('Error reading file:', error);
      throw new Error('Failed to read file');
    }
  }
  
  /**
   * Delete a file attachment
   */
  async deleteFileAttachment(id: number): Promise<boolean> {
    try {
      const file = await this.getFileAttachment(id);
      
      if (!file) {
        throw new Error('File attachment not found');
      }
      
      // Delete file from filesystem
      const filePath = path.join(process.cwd(), file.filePath);
      if (await exists(filePath)) {
        await unlink(filePath);
      }
      
      // Delete database record
      await db.delete(fileAttachments).where(eq(fileAttachments.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting file attachment:', error);
      throw new Error('Failed to delete file attachment');
    }
  }
  
  /**
   * Check if a user has access to a file
   */
  async canAccessFile(fileId: number, userId: number): Promise<boolean> {
    try {
      const file = await this.getFileAttachment(fileId);
      
      if (!file) {
        return false;
      }
      
      // Public files are accessible to all
      if (file.isPublic) {
        return true;
      }
      
      // File owner always has access
      if (file.createdBy === userId) {
        return true;
      }
      
      // Admin users have access (would need to check user role)
      // TODO: Implement role-based access
      
      return false;
    } catch (error) {
      console.error('Error checking file access:', error);
      return false;
    }
  }
}

export const fileService = new FileService();