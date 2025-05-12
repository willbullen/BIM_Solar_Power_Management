import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

/**
 * Tool for compiling reports from data in either Markdown or PDF format
 */
export class CompileReportTool extends Tool {
  name = "CompileReport";
  description = "Generate reports from structured data in either Markdown or PDF format";
  
  // Reports directory
  private reportsDir: string;
  
  constructor() {
    super();
    
    // Set the reports directory to a folder in the project
    this.reportsDir = path.join(process.cwd(), "reports");
    
    // Ensure reports directory exists
    this.ensureReportsDirectory();
  }
  
  /**
   * Ensure the reports directory exists
   */
  private ensureReportsDirectory() {
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
        console.log(`Created reports directory at ${this.reportsDir}`);
      }
    } catch (error) {
      console.error("Error creating reports directory:", error);
    }
  }
  
  /**
   * Define the schema for the tool's input
   * Using the format expected by LangChain.js for OpenAI functions tools
   */
  schema = z.object({
    input: z.string().describe("Report details in the format: 'TITLE: <report-title>; CONTENT: <markdown-content>; FORMAT: [markdown|pdf]'")
  }).transform(input => {
    if (typeof input === 'object' && input !== null && 'input' in input) {
      return input.input || '';
    }
    return input as string || '';
  });
  
  // Property overrides defined in constructor
  
  /**
   * Generate a sanitized filename from the report title
   * @param title The title of the report
   */
  private generateFilename(title: string, format: string): string {
    // Replace invalid filename characters with underscores
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    
    // Add date prefix for unique filenames
    const datePrefix = new Date().toISOString().split("T")[0];
    
    return `${datePrefix}-${sanitizedTitle}.${format === "pdf" ? "pdf" : "md"}`;
  }
  
  /**
   * Generate a Markdown report
   * @param title The title of the report
   * @param content The content of the report
   */
  private async generateMarkdownReport(title: string, content: string): Promise<string> {
    try {
      // Generate filename
      const filename = this.generateFilename(title, "markdown");
      const filepath = path.join(this.reportsDir, filename);
      
      // Create report content with title and timestamp
      const timestamp = new Date().toISOString();
      const reportContent = `# ${title}\n\n_Generated: ${timestamp}_\n\n${content}`;
      
      // Write to file
      fs.writeFileSync(filepath, reportContent);
      
      return filepath;
    } catch (error) {
      console.error("Error generating Markdown report:", error);
      throw new Error(`Failed to generate Markdown report: ${error.message}`);
    }
  }
  
  /**
   * Generate a PDF report
   * @param title The title of the report
   * @param content The content of the report
   */
  private async generatePdfReport(title: string, content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Generate filename
        const filename = this.generateFilename(title, "pdf");
        const filepath = path.join(this.reportsDir, filename);
        
        // Create a new PDF document
        const doc = new PDFDocument({
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: title,
            Author: "Emporium AI Assistant",
            CreationDate: new Date()
          }
        });
        
        // Create a write stream to the file
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);
        
        // Set up PDF styling
        doc.font('Helvetica-Bold').fontSize(24).text(title, { align: 'center' });
        doc.moveDown();
        
        // Add timestamp
        const timestamp = new Date().toISOString();
        doc.font('Helvetica-Oblique').fontSize(10).text(`Generated: ${timestamp}`, { align: 'center' });
        doc.moveDown(2);
        
        // Add content - basic Markdown parsing for headings and paragraphs
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.startsWith('# ')) {
            // H1 heading
            doc.font('Helvetica-Bold').fontSize(18).text(line.substring(2));
            doc.moveDown();
          } else if (line.startsWith('## ')) {
            // H2 heading
            doc.font('Helvetica-Bold').fontSize(16).text(line.substring(3));
            doc.moveDown();
          } else if (line.startsWith('### ')) {
            // H3 heading
            doc.font('Helvetica-Bold').fontSize(14).text(line.substring(4));
            doc.moveDown();
          } else if (line.startsWith('- ')) {
            // List item
            doc.font('Helvetica').fontSize(12).text(`• ${line.substring(2)}`, { indent: 20 });
            doc.moveDown(0.5);
          } else if (line.trim() === '') {
            // Empty line
            doc.moveDown(0.5);
          } else {
            // Normal paragraph
            doc.font('Helvetica').fontSize(12).text(line);
            doc.moveDown(0.5);
          }
        }
        
        // Finalize the PDF
        doc.end();
        
        // Wait for the stream to finish
        stream.on('finish', () => {
          resolve(filepath);
        });
        
        stream.on('error', (err) => {
          reject(new Error(`PDF generation error: ${err.message}`));
        });
      } catch (error) {
        console.error("Error generating PDF report:", error);
        reject(new Error(`Failed to generate PDF report: ${error.message}`));
      }
    });
  }
  
  /**
   * Execute the tool with the specified input
   * @param input String in format 'TITLE: <title>; CONTENT: <content>; FORMAT: <format>'
   */
  async _call(input: string): Promise<string> {
    try {
      // Default values
      let title = '';
      let content = '';
      let format: "markdown" | "pdf" = "markdown";

      // Support both object input (from direct API calls) and string input (from LangChain)
      if (typeof input === 'object' && input !== null) {
        // Handle direct API call with object format
        if ('title' in input && 'content' in input) {
          const arg = input as any;
          title = arg.title;
          content = arg.content;
          format = arg.format || "markdown";
        }
      } else if (typeof input === 'string') {
        // Parse from LangChain format "TITLE: ...; CONTENT: ...; FORMAT: ..."
        const titleMatch = input.match(/TITLE:\s*(.*?)(?:;|\s*CONTENT:|$)/s);
        const contentMatch = input.match(/CONTENT:\s*(.*?)(?:;|\s*FORMAT:|$)/s);
        const formatMatch = input.match(/FORMAT:\s*(markdown|pdf)/i);
        
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        }
        
        if (contentMatch && contentMatch[1]) {
          content = contentMatch[1].trim();
        }
        
        if (formatMatch && formatMatch[1]) {
          format = formatMatch[1].toLowerCase() as "markdown" | "pdf";
        }
      }
      
      console.log(`Generating ${format} report with title: ${title}`);
      
      // Validate the input
      if (!title || !content) {
        return JSON.stringify({
          error: "Report title and content are required. Use format 'TITLE: <title>; CONTENT: <content>; FORMAT: [markdown|pdf]'"
        });
      }
      
      let filepath: string;
      
      // Generate the report in the requested format
      if (format === "pdf") {
        filepath = await this.generatePdfReport(title, content);
      } else {
        filepath = await this.generateMarkdownReport(title, content);
      }
      
      // Return result
      return JSON.stringify({
        success: true,
        format,
        filepath,
        message: `${format.toUpperCase()} report generated successfully`,
        filename: path.basename(filepath)
      });
    } catch (error) {
      console.error("Error compiling report:", error);
      return JSON.stringify({
        error: `Report generation error: ${error instanceof Error ? error.message : String(error)}`,
        input: typeof input === 'string' ? input : JSON.stringify(input)
      });
    }
  }
}