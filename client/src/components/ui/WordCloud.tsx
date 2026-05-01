import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

interface WordCloudProps {
  words: {
    text: string;
    value: number;
  }[];
  maxFontSize?: number;
  minFontSize?: number;
  className?: string;
}

export function WordCloud({ 
  words, 
  maxFontSize = 48, 
  minFontSize = 14,
  className = ''
}: WordCloudProps) {
  // Calculate word positions
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Normalize font sizes
  const normalizedWords = useMemo(() => {
    if (words.length === 0) return [];
    
    const maxValue = Math.max(...words.map(word => word.value));
    const minValue = Math.min(...words.map(word => word.value));
    
    return words.map(word => {
      let fontSize;
      if (maxValue === minValue) {
        fontSize = (maxFontSize + minFontSize) / 2;
      } else {
        const normalized = (word.value - minValue) / (maxValue - minValue);
        fontSize = minFontSize + normalized * (maxFontSize - minFontSize);
      }
      
      // Calculate a unique position for each word
      const angle = Math.random() * 2 * Math.PI;
      const radius = 30 + Math.random() * 70; // Random position within the cloud
      
      // Calculate hue based on value (higher values = more blue)
      const hue = 200 + (word.value / maxValue) * 40; // range from 200 to 240 (blues)
      const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
      const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
      
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      return {
        ...word,
        fontSize,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        color
      };
    });
  }, [words, maxFontSize, minFontSize]);
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.05,
        duration: 0.5
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0, scale: 0.8 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { 
        type: "spring", 
        stiffness: 150,
        damping: 15,
        mass: 1
      }
    }
  };
  
  // Hover animations
  const wordHover = {
    scale: 1.15,
    color: "#3b82f6", // blue-500
    transition: { duration: 0.2 }
  };
  
  return (
    <div className={`relative w-full h-full ${className}`} ref={canvasRef}>
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {normalizedWords.map((word, i) => (
          <motion.div
            key={`${word.text}-${i}`}
            className="absolute cursor-pointer select-none"
            variants={itemVariants}
            whileHover={wordHover}
            style={{
              fontSize: `${word.fontSize}px`,
              fontWeight: word.value > (maxFontSize / 2) ? 'bold' : 'normal',
              color: word.color,
              transform: `translate(${word.x}px, ${word.y}px)`,
              zIndex: Math.floor(word.fontSize),
            }}
          >
            {word.text}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default WordCloud;