import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Palette } from "lucide-react";

interface TransformAnimationProps {
  isVisible: boolean;
  transformType: "type" | "color" | "both";
  newValue?: string;
  onComplete?: () => void;
}

const colorMap: Record<string, string> = {
  RED: "#ef4444",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  PURPLE: "#a855f7",
  ORANGE: "#f97316",
  PINK: "#ec4899",
  BLACK: "#1f2937",
  WHITE: "#f3f4f6",
  SILVER: "#9ca3af",
};

export const TransformAnimation = ({
  isVisible,
  transformType,
  newValue,
  onComplete,
}: TransformAnimationProps) => {
  const color = newValue ? colorMap[newValue.toUpperCase()] || "#10b981" : "#10b981";

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <>
          {/* Spinning ring effect */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0.8, 1.2, 1.3, 1.4],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              border: `3px dashed ${color}`,
              boxShadow: `0 0 20px ${color}`,
            }}
          />

          {/* Inner glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.6, 0.3, 0],
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
            style={{
              background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            }}
          />

          {/* Sparkle particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full pointer-events-none z-20"
              style={{
                background: color,
                boxShadow: `0 0 6px ${color}`,
                left: "50%",
                top: "50%",
              }}
              initial={{ 
                x: "-50%", 
                y: "-50%", 
                opacity: 0,
                scale: 0,
              }}
              animate={{ 
                x: `calc(-50% + ${Math.cos(i * Math.PI / 4) * 50}px)`,
                y: `calc(-50% + ${Math.sin(i * Math.PI / 4) * 50}px)`,
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Center icon */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            initial={{ opacity: 0, scale: 0, rotate: -180 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0, 1.2, 1, 0],
              rotate: [0, 0, 0, 180],
            }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div 
              className="p-2 rounded-full"
              style={{ 
                background: `${color}cc`,
                boxShadow: `0 0 15px ${color}`,
              }}
            >
              {transformType === "color" ? (
                <Palette className="w-5 h-5 text-white" />
              ) : (
                <RefreshCw className="w-5 h-5 text-white" />
              )}
            </div>
          </motion.div>

          {/* Text label */}
          {newValue && (
            <motion.div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
              transition={{ duration: 1.2, delay: 0.1 }}
            >
              <span 
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ 
                  background: `${color}ee`,
                  color: "white",
                  boxShadow: `0 0 10px ${color}`,
                }}
              >
                → {newValue}
              </span>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

// Persistent subtle indicator for transformed cards
export const TransformIndicator = ({ 
  convertedTypes, 
  convertedColors 
}: { 
  convertedTypes?: string[]; 
  convertedColors?: string[]; 
}) => {
  const hasTypeTransform = convertedTypes && convertedTypes.length > 0;
  const hasColorTransform = convertedColors && convertedColors.length > 0;
  
  if (!hasTypeTransform && !hasColorTransform) return null;

  const primaryColor = hasColorTransform 
    ? colorMap[convertedColors![0].toUpperCase()] || "#10b981"
    : "#10b981";

  return (
    <motion.div
      className="absolute inset-0 rounded-full pointer-events-none"
      animate={{
        boxShadow: [
          `0 0 8px ${primaryColor}60, inset 0 0 8px ${primaryColor}30`,
          `0 0 12px ${primaryColor}80, inset 0 0 12px ${primaryColor}40`,
          `0 0 8px ${primaryColor}60, inset 0 0 8px ${primaryColor}30`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
};