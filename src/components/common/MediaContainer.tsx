import React from 'react';
import { cn } from '../../lib/utils';

interface MediaContainerProps {
  src: string;
  alt: string;
  type?: 'image' | 'video';
  className?: string;
  containerClassName?: string;
}

export const MediaContainer: React.FC<MediaContainerProps> = ({ 
  src, 
  alt, 
  type = 'image', 
  className,
  containerClassName 
}) => {
  return (
    <div className={cn("relative w-full overflow-hidden bg-slate-100", containerClassName)}>
      {type === 'image' ? (
        <img 
          src={src} 
          alt={alt} 
          className={cn("w-full h-full object-cover transition-transform duration-700", className)} 
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-image.png'; // Fallback if necessary
          }}
        />
      ) : (
        <video
          src={src}
          controls
          className={cn("w-full h-full object-cover", className)}
          onError={(e) => {
            console.error("Video load error", e);
          }}
        />
      )}
    </div>
  );
};
