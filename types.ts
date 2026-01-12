
export interface ProcessedImage {
  id: string;
  originalName: string;
  originalUrl: string;
  processedUrl: string | null;
  status: 'pending' | 'analyzing' | 'processing' | 'completed' | 'error';
  subject?: string;
  error?: string;
}

export enum ProcessingStep {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  REMOVING_BG = 'REMOVING_BG',
  DONE = 'DONE'
}
