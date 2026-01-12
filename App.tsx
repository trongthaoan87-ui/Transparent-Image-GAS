
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Zap, 
  Loader2,
  FileImage,
  Plus
} from 'lucide-react';
import { identifySubject } from './services/gemini';
import { ProcessedImage } from './types';
import imglyRemoveBackground from '@imgly/background-removal';

const App: React.FC = () => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const newImages: ProcessedImage[] = newFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        originalName: file.name,
        originalUrl: URL.createObjectURL(file),
        processedUrl: null,
        status: 'pending'
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const processSingleImage = async (image: ProcessedImage) => {
    // Only update status if it's currently pending or in an error state
    if (image.status === 'completed') return;

    setImages(prev => prev.map(img => 
      img.id === image.id ? { ...img, status: 'analyzing' } : img
    ));

    try {
      // 1. Convert to blob for background removal
      const response = await fetch(image.originalUrl);
      const blob = await response.blob();

      // Start BG removal
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'processing' } : img
      ));

      // 2. Remove background using WASM
      // Note: imglyRemoveBackground handles the loading of WASM models automatically
      const resultBlob = await imglyRemoveBackground(blob);
      const processedUrl = URL.createObjectURL(resultBlob);

      // 3. Parallel: Analyze with Gemini for descriptive subject tagging
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const base64 = await base64Promise;
      const subject = await identifySubject(base64);

      setImages(prev => prev.map(img => 
        img.id === image.id ? { 
          ...img, 
          status: 'completed', 
          processedUrl, 
          subject 
        } : img
      ));
    } catch (err: any) {
      console.error("Processing Error:", err);
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'error', error: err.message || "Failed to process image" } : img
      ));
    }
  };

  const startBatchProcess = async () => {
    const pending = images.filter(img => img.status === 'pending');
    if (pending.length === 0) return;

    setIsProcessing(true);
    // Process sequentially to manage memory and browser resources
    for (const img of pending) {
      await processSingleImage(img);
    }
    setIsProcessing(false);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const imgToRemove = prev.find(img => img.id === id);
      if (imgToRemove?.originalUrl) URL.revokeObjectURL(imgToRemove.originalUrl);
      if (imgToRemove?.processedUrl) URL.revokeObjectURL(imgToRemove.processedUrl);
      return filtered;
    });
  };

  const downloadImage = (img: ProcessedImage) => {
    if (!img.processedUrl) return;
    const link = document.createElement('a');
    link.href = img.processedUrl;
    // Clean filename
    const cleanName = img.originalName.replace(/\.[^/.]+$/, "");
    const subjectPrefix = img.subject ? `${img.subject.replace(/\s+/g, '_')}-` : '';
    link.download = `${subjectPrefix}${cleanName}-magic-cutout.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    images.forEach(img => {
      if (img.status === 'completed') downloadImage(img);
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary-500 rounded-2xl mb-4 shadow-lg shadow-primary-500/20">
          <Layers className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
          Magic Cutout <span className="text-primary-500">AI</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Professional background removal in your browser. Fast, private, and powerful.
        </p>
      </div>

      <div className="space-y-8">
        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center transition-all hover:border-primary-400 dark:hover:border-primary-600 group relative shadow-sm">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-10 h-10 text-primary-500" />
            </div>
            <p className="text-xl font-bold mb-2 dark:text-white">Drop images to start magic</p>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Click to browse or drag & drop (JPG, PNG, WEBP)</p>
          </div>
        </div>

        {/* Controls Bar */}
        {images.length > 0 && (
          <div className="sticky top-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300">
                {images.length} Files
              </div>
              <div className="text-sm font-medium text-gray-400">
                {images.filter(img => img.status === 'completed').length} / {images.length} Completed
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImages([])}
                className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all font-semibold"
              >
                <Trash2 className="w-4 h-4" /> Reset
              </button>
              
              {images.some(img => img.status === 'completed') && (
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded-xl transition-all font-semibold"
                >
                  <Download className="w-4 h-4" /> Save All
                </button>
              )}

              <button
                disabled={isProcessing || !images.some(img => img.status === 'pending')}
                onClick={startBatchProcess}
                className={`flex items-center gap-2 px-8 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white rounded-xl transition-all font-bold shadow-lg shadow-primary-500/25 active:scale-95 ${isProcessing ? 'animate-shine' : ''}`}
              >
                {isProcessing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Magic Working...</>
                ) : (
                  <><Zap className="w-5 h-5 fill-current" /> Process All</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => (
            <div 
              key={img.id} 
              className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col group transition-all duration-300 hover:shadow-2xl hover:border-primary-200 dark:hover:border-primary-900"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-950">
                {img.status === 'completed' && img.processedUrl ? (
                  <div className="w-full h-full checkerboard flex items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
                    <img 
                      src={img.processedUrl} 
                      alt="Cutout Result" 
                      className="max-w-full max-h-full object-contain drop-shadow-xl"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full relative group/img">
                    <img 
                      src={img.originalUrl} 
                      alt="Original Preview" 
                      className={`w-full h-full object-cover transition-all duration-700 ${img.status !== 'pending' ? 'blur-md grayscale opacity-30 scale-105' : 'group-hover/img:scale-105'}`}
                    />
                    {img.status !== 'pending' && img.status !== 'completed' && img.status !== 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                        <div className="relative">
                          <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                             <Zap className="w-6 h-6 text-primary-500 fill-current animate-pulse" />
                          </div>
                        </div>
                        <p className="mt-6 font-black text-xs uppercase tracking-widest text-primary-500 bg-primary-50 dark:bg-primary-900/40 px-3 py-1 rounded-full">
                          {img.status === 'analyzing' ? 'Analyzing Scene' : 'Removing Background'}
                        </p>
                      </div>
                    )}
                    {img.status === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/90 dark:bg-red-950/90 text-red-600 p-8 text-center">
                        <AlertCircle className="w-10 h-10 mb-3" />
                        <p className="font-bold">Processing Failed</p>
                        <p className="text-[10px] mt-2 opacity-80 leading-relaxed max-w-[150px]">{img.error}</p>
                        <button 
                          onClick={() => processSingleImage(img)}
                          className="mt-4 text-[10px] font-bold underline decoration-2 underline-offset-4"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Floating Tags */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {img.status === 'completed' && (
                    <div className="bg-green-500 text-white p-1.5 rounded-full shadow-lg animate-bounce">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {img.subject && (
                    <div className="bg-white/95 dark:bg-black/80 text-gray-900 dark:text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-white/20">
                      {img.subject}
                    </div>
                  )}
                </div>

                {/* Card Hover Actions */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 flex flex-col gap-2">
                  <button 
                    onClick={() => removeImage(img.id)}
                    className="p-3 bg-white/90 dark:bg-gray-800/90 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white shadow-xl transition-all"
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  {img.status === 'completed' && (
                    <button 
                      onClick={() => downloadImage(img)}
                      className="p-3 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 shadow-xl transition-all"
                      title="Download PNG"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="p-5 flex items-center justify-between bg-white dark:bg-gray-900 group-hover:bg-primary-50/30 dark:group-hover:bg-primary-950/10 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 p-2.5 rounded-xl shrink-0 group-hover:bg-white dark:group-hover:bg-gray-800 transition-colors shadow-sm">
                    <FileImage className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold truncate dark:text-white leading-none mb-1">{img.originalName}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">
                      {img.status === 'completed' ? 'Transparent PNG' : 'Awaiting Magic'}
                    </p>
                  </div>
                </div>
                {img.status === 'pending' && (
                   <button 
                    onClick={() => processSingleImage(img)}
                    className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-primary-500 hover:bg-primary-500 hover:text-white rounded-xl transition-all"
                    title="Process now"
                   >
                     <Zap className="w-5 h-5 fill-current" />
                   </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Empty State */}
        {images.length === 0 && (
          <div className="py-24 text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner border border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <FileImage className="w-16 h-16 text-gray-200 dark:text-gray-800" />
                  <Plus className="absolute -top-2 -right-2 w-8 h-8 text-primary-300 animate-pulse" />
                </div>
             </div>
             <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Your workspace is empty</h3>
             <p className="max-w-md text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
               Add high-quality product shots, portraits, or any photo. Our AI will precisely extract the subject and provide a transparent background instantly.
             </p>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="mt-24 pt-10 border-t border-gray-100 dark:border-gray-900">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-600">
          <span className="flex items-center gap-2 group cursor-default">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 group-hover:scale-150 transition-transform"></div> 
            Edge Powered WASM
          </span>
          <span className="flex items-center gap-2 group cursor-default">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 group-hover:scale-150 transition-transform"></div> 
            Gemini Semantic Analysis
          </span>
          <span className="flex items-center gap-2 group cursor-default">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 group-hover:scale-150 transition-transform"></div> 
            Privacy First - No Uploads
          </span>
        </div>
        <p className="mt-8 text-center text-gray-300 dark:text-gray-800 text-[10px] font-medium">
          &copy; {new Date().getFullYear()} Magic Cutout Studio. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default App;
