import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Download } from 'lucide-react';

export interface AttachmentItem {
  name?: string;
  type?: string;
  data: string;
}

interface AttachmentsGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: AttachmentItem[];
  initialIndex?: number;
  title?: string;
}

export const AttachmentsGalleryModal: React.FC<AttachmentsGalleryModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title = 'معاينة المرفقات'
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, onClose]);

  if (!isOpen || !images || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[80] flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div 
        className="flex items-center justify-between text-white border-b border-white/10 pb-3 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-base sm:text-lg">{title}</span>
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
            {currentIndex + 1} / {images.length}
          </span>
          {currentImage.name && (
            <span className="text-xs text-slate-300 max-w-xs truncate hidden sm:inline-block">
              {currentImage.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentImage.data && (
            <a
              href={currentImage.data}
              download={currentImage.name || `attachment-${currentIndex + 1}.png`}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="تحميل الصورة"
              onClick={e => e.stopPropagation()}
            >
              <Download className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full text-slate-300 hover:text-white transition-colors"
            title="إغلاق (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main View Area with Next / Prev */}
      <div 
        className="relative flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-all hover:scale-110 z-10 shadow-xl border border-white/10"
            title="السابق"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        <div className="flex items-center justify-center max-h-full max-w-full">
          <img
            key={currentIndex}
            src={currentImage.data}
            alt={currentImage.name || `مرفق ${currentIndex + 1}`}
            className="max-h-[70vh] sm:max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-150"
          />
        </div>

        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-all hover:scale-110 z-10 shadow-xl border border-white/10"
            title="التالي"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div 
          className="pt-3 border-t border-white/10 flex justify-center shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-2 overflow-x-auto max-w-full py-1 px-2">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  idx === currentIndex 
                    ? 'border-blue-500 scale-105 shadow-lg ring-2 ring-blue-400/50' 
                    : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
                }`}
              >
                <img src={img.data} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 left-0 bg-black/60 text-[9px] text-white text-center font-bold">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
