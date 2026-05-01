import React, { useState, useEffect } from 'react';

interface AnimatedGradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  speed?: number; // Animation speed in seconds
  colors?: string[]; // Array of colors to cycle through
  intensity?: number; // Value between 0 and 1 to control opacity
}

const AnimatedGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({
  children,
  className = '',
  speed = 20,
  colors = [
    'rgba(66, 65, 229, 0.03)', // Indigo
    'rgba(139, 92, 246, 0.03)', // Purple
    'rgba(236, 72, 153, 0.03)', // Pink
    'rgba(96, 165, 250, 0.03)', // Blue
    'rgba(16, 185, 129, 0.03)'  // Green
  ],
  intensity = 0.2
}) => {
  const [gradientIndex, setGradientIndex] = useState(0);
  const [prevGradientIndex, setPrevGradientIndex] = useState(colors.length - 1);
  const [transition, setTransition] = useState(false);

  // Create colors with proper opacity based on intensity
  const adjustedColors = colors.map(color => {
    if (color.startsWith('rgba')) {
      const parts = color.split(',');
      const lastPart = parts[3].split(')')[0];
      const originalOpacity = parseFloat(lastPart);
      const newOpacity = originalOpacity * intensity;
      return `${parts[0]},${parts[1]},${parts[2]}, ${newOpacity})`;
    }
    return color;
  });

  // Effect to handle animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPrevGradientIndex(gradientIndex);
      setGradientIndex((prevIndex) => (prevIndex + 1) % adjustedColors.length);
      setTransition(true);
      
      // Reset transition after animation completes
      const timeout = setTimeout(() => {
        setTransition(false);
      }, speed * 1000);
      
      return () => clearTimeout(timeout);
    }, speed * 1000);
    
    return () => clearInterval(interval);
  }, [gradientIndex, adjustedColors.length, speed]);

  return (
    <div className={`relative ${className}`}>
      {/* Static background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${adjustedColors[gradientIndex]}, transparent 60%), 
                      radial-gradient(circle at 70% 30%, ${adjustedColors[(gradientIndex + 1) % adjustedColors.length]}, transparent 50%),
                      radial-gradient(circle at 60% 80%, ${adjustedColors[(gradientIndex + 2) % adjustedColors.length]}, transparent 40%)`,
          transition: transition ? `all ${speed * 0.5}s ease-in-out` : 'none'
        }}
      />
      
      {/* Content - Removed fixed height constraints to ensure it adapts to content */}
      <div className="relative z-10 flex-grow overflow-visible">
        {children}
      </div>
    </div>
  );
};

export default AnimatedGradientBackground;