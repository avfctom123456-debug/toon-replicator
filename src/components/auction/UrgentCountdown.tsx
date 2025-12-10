import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface UrgentCountdownProps {
  endsAt: string;
  now: number;
}

export function UrgentCountdown({ endsAt, now }: UrgentCountdownProps) {
  const endTime = new Date(endsAt).getTime();
  const diff = endTime - now;
  
  const isEnded = diff <= 0;
  const isUrgent = diff <= 60 * 1000; // Under 1 minute
  const isCritical = diff <= 30 * 1000; // Under 30 seconds
  const isWarning = diff <= 5 * 60 * 1000; // Under 5 minutes

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  if (isEnded) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/50">
        <Clock className="h-5 w-5 text-red-400" />
        <span className="text-lg font-bold text-red-400">Auction Ended</span>
      </div>
    );
  }

  return (
    <div 
      className={`
        relative overflow-hidden rounded-lg px-4 py-3 transition-all duration-300
        ${isCritical 
          ? "bg-red-500/30 border-2 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
          : isUrgent 
            ? "bg-orange-500/30 border-2 border-orange-500 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.4)]"
            : isWarning 
              ? "bg-orange-500/20 border border-orange-500/50"
              : "bg-muted/50 border border-border"
        }
      `}
    >
      {/* Animated background pulse for critical times */}
      {isCritical && (
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-red-600/30 to-red-500/20 animate-[shimmer_1s_ease-in-out_infinite]" />
      )}
      
      <div className="relative flex items-center gap-3">
        <Clock 
          className={`h-5 w-5 transition-colors ${
            isCritical ? "text-red-400" : isUrgent ? "text-orange-400" : isWarning ? "text-orange-400" : "text-muted-foreground"
          }`} 
        />
        
        <div className="flex items-center gap-1 font-mono">
          {hours > 0 && (
            <>
              <TimeBlock value={formatNumber(hours)} urgent={isUrgent} critical={isCritical} />
              <span className={`text-xl font-bold ${isCritical ? "text-red-400" : isUrgent ? "text-orange-400" : "text-foreground"}`}>:</span>
            </>
          )}
          <TimeBlock value={formatNumber(minutes)} urgent={isUrgent} critical={isCritical} />
          <span className={`text-xl font-bold ${isCritical ? "text-red-400 animate-pulse" : isUrgent ? "text-orange-400" : "text-foreground"}`}>:</span>
          <TimeBlock value={formatNumber(seconds)} urgent={isUrgent} critical={isCritical} isSeconds />
        </div>

        {/* Urgency label */}
        {isCritical && (
          <span className="ml-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-red-500 text-white rounded animate-bounce">
            Ending!
          </span>
        )}
        {isUrgent && !isCritical && (
          <span className="ml-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-orange-500 text-white rounded">
            Last minute!
          </span>
        )}
      </div>
    </div>
  );
}

interface TimeBlockProps {
  value: string;
  urgent: boolean;
  critical: boolean;
  isSeconds?: boolean;
}

function TimeBlock({ value, urgent, critical, isSeconds }: TimeBlockProps) {
  return (
    <div 
      className={`
        flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md font-bold text-xl
        transition-all duration-200
        ${critical 
          ? `bg-red-500/40 text-red-100 ${isSeconds ? "animate-[pulse-scale_1s_ease-in-out_infinite]" : ""}` 
          : urgent 
            ? "bg-orange-500/40 text-orange-100"
            : "bg-background/80 text-foreground"
        }
      `}
    >
      {value.split('').map((digit, i) => (
        <span 
          key={i}
          className={`inline-block ${critical && isSeconds ? "animate-[digit-flip_1s_ease-in-out_infinite]" : ""}`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}
