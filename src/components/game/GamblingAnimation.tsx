import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface GamblingResult {
  type: "coin" | "dice" | "double-dice";
  outcome: number | "heads" | "tails"; // For dice: 1-6, for coin: heads/tails
  secondDie?: number; // For double dice
  pointChange: number;
  isPositive: boolean;
  cardTitle: string;
  effectDescription: string;
}

interface GamblingAnimationProps {
  result: GamblingResult | null;
  onComplete: () => void;
}

// Dice face SVG patterns
const DiceFace = ({ value, size = 80 }: { value: number; size?: number }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-lg">
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        rx="12"
        fill="white"
        stroke="#333"
        strokeWidth="3"
      />
      {dotPositions[value]?.map((pos, i) => (
        <circle key={i} cx={pos[0]} cy={pos[1]} r="8" fill="#1a1a1a" />
      ))}
    </svg>
  );
};

// Coin component
const Coin = ({ side, isFlipping }: { side: "heads" | "tails"; isFlipping: boolean }) => {
  return (
    <div
      className={cn(
        "w-24 h-24 rounded-full relative transition-transform duration-100",
        isFlipping && "animate-spin"
      )}
      style={{
        transformStyle: "preserve-3d",
        animation: isFlipping ? "coinFlip 0.15s linear infinite" : undefined,
      }}
    >
      {/* Heads side */}
      <div
        className={cn(
          "absolute inset-0 rounded-full flex items-center justify-center font-bold text-2xl border-4",
          "bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 border-yellow-700 text-yellow-900",
          side === "tails" && !isFlipping && "opacity-0"
        )}
        style={{ backfaceVisibility: "hidden" }}
      >
        <span className="drop-shadow">H</span>
      </div>
      {/* Tails side */}
      <div
        className={cn(
          "absolute inset-0 rounded-full flex items-center justify-center font-bold text-2xl border-4",
          "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-800 text-amber-100",
          side === "heads" && !isFlipping && "opacity-0"
        )}
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <span className="drop-shadow">T</span>
      </div>
    </div>
  );
};

export const GamblingAnimation = ({ result, onComplete }: GamblingAnimationProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentDiceValue, setCurrentDiceValue] = useState(1);
  const [currentSecondDice, setCurrentSecondDice] = useState(1);
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");

  // Sound effects
  const playSound = useCallback((type: "coin" | "dice" | "win" | "lose") => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case "coin":
        // Metallic ping sound
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.05);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
      case "dice":
        // Rattle sound
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.05);
        oscillator.frequency.setValueAtTime(120, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.12);
        break;
      case "win":
        // Victory fanfare
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        break;
      case "lose":
        // Sad trombone
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.35);
        break;
    }
  }, []);

  useEffect(() => {
    if (!result) return;

    setIsAnimating(true);
    setShowResult(false);

    // Animation timing
    const animationDuration = result.type === "coin" ? 1500 : 2000;
    let animationFrame: number;
    let soundInterval: NodeJS.Timeout;

    if (result.type === "coin") {
      // Coin flip animation
      soundInterval = setInterval(() => playSound("coin"), 100);
      
      const flipAnimation = () => {
        setCoinSide(prev => prev === "heads" ? "tails" : "heads");
        animationFrame = requestAnimationFrame(flipAnimation);
      };
      animationFrame = requestAnimationFrame(flipAnimation);

      setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        clearInterval(soundInterval);
        setCoinSide(result.outcome as "heads" | "tails");
        setShowResult(true);
        playSound(result.isPositive ? "win" : "lose");
      }, animationDuration);
    } else {
      // Dice roll animation
      soundInterval = setInterval(() => playSound("dice"), 80);
      
      const rollAnimation = () => {
        setCurrentDiceValue(Math.floor(Math.random() * 6) + 1);
        if (result.type === "double-dice") {
          setCurrentSecondDice(Math.floor(Math.random() * 6) + 1);
        }
        animationFrame = requestAnimationFrame(rollAnimation);
      };
      animationFrame = requestAnimationFrame(rollAnimation);

      setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        clearInterval(soundInterval);
        setCurrentDiceValue(result.outcome as number);
        if (result.type === "double-dice" && result.secondDie) {
          setCurrentSecondDice(result.secondDie);
        }
        setShowResult(true);
        playSound(result.isPositive ? "win" : "lose");
      }, animationDuration);
    }

    // Complete callback
    const completeTimeout = setTimeout(() => {
      setIsAnimating(false);
      onComplete();
    }, animationDuration + 2000);

    return () => {
      clearTimeout(completeTimeout);
      clearInterval(soundInterval);
      cancelAnimationFrame(animationFrame);
    };
  }, [result, onComplete, playSound]);

  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-600 max-w-md mx-4">
        {/* Card Title */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white">{result.cardTitle}</h3>
          <p className="text-sm text-slate-400">{result.effectDescription}</p>
        </div>

        {/* Animation Container */}
        <div className="flex flex-col items-center justify-center min-h-[150px] mb-6">
          {result.type === "coin" ? (
            <div className="relative">
              <Coin side={coinSide} isFlipping={isAnimating && !showResult} />
              {isAnimating && !showResult && (
                <div className="absolute -inset-4 animate-pulse rounded-full bg-yellow-500/20" />
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              <div className={cn(
                "transition-transform",
                isAnimating && !showResult && "animate-bounce"
              )}>
                <DiceFace value={currentDiceValue} />
              </div>
              {result.type === "double-dice" && (
                <div className={cn(
                  "transition-transform",
                  isAnimating && !showResult && "animate-bounce"
                )} style={{ animationDelay: "0.1s" }}>
                  <DiceFace value={currentSecondDice} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Result Display */}
        {showResult && (
          <div className="text-center animate-scale-in">
            <div className={cn(
              "text-4xl font-bold mb-2",
              result.isPositive ? "text-green-400" : "text-red-400"
            )}>
              {result.pointChange >= 0 ? "+" : ""}{result.pointChange}
            </div>
            <div className={cn(
              "text-lg font-medium",
              result.isPositive ? "text-green-300" : "text-red-300"
            )}>
              {result.type === "coin" 
                ? (result.outcome === "heads" ? "🪙 HEADS!" : "🪙 TAILS!")
                : result.type === "double-dice"
                  ? `🎲 ${result.outcome} + ${result.secondDie} = ${(result.outcome as number) + (result.secondDie || 0)}`
                  : `🎲 Rolled a ${result.outcome}!`
              }
            </div>
            <div className="mt-4 text-sm text-slate-400">
              {result.isPositive ? "Lucky!" : "Better luck next time..."}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isAnimating && !showResult && (
          <div className="text-center text-slate-400 animate-pulse">
            {result.type === "coin" ? "Flipping..." : "Rolling..."}
          </div>
        )}
      </div>

      {/* Styles for coin flip animation */}
      <style>{`
        @keyframes coinFlip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>
    </div>
  );
};

// Helper function to process gambling effects and return results
export function processGamblingEffect(
  description: string,
  cardTitle: string,
  basePoints: number
): GamblingResult | null {
  const lowerDesc = description.toLowerCase();

  // Coin flip: +X or -X
  let match = lowerDesc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+-(\d+)/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const loseAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : -loseAmount,
      isPositive: isHeads,
      cardTitle,
      effectDescription: `Coin flip: +${winAmount} or -${loseAmount}`,
    };
  }

  // Coin flip: double or zero
  if (lowerDesc.includes("coin flip") && lowerDesc.includes("double") && lowerDesc.includes("zero")) {
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints : -basePoints, // Double adds basePoints, zero subtracts all
      isPositive: isHeads,
      cardTitle,
      effectDescription: "Coin flip: x2 or x0",
    };
  }

  // Coin flip: +X or cancel
  match = lowerDesc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+cancel/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : -999, // -999 signals cancel
      isPositive: isHeads,
      cardTitle,
      effectDescription: `Coin flip: +${winAmount} or cancel`,
    };
  }

  // Coin flip: steal or give
  match = lowerDesc.match(/coin\s*flip:\s*steal\s*(\d+)\s*.+\s*give\s*(\d+)/);
  if (match) {
    const stealAmount = parseInt(match[1]);
    const giveAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? stealAmount : -giveAmount,
      isPositive: isHeads,
      cardTitle,
      effectDescription: `Coin flip: steal ${stealAmount} or give ${giveAmount}`,
    };
  }

  // Coin flip: buff or debuff team
  match = lowerDesc.match(/coin\s*flip:\s*\+(\d+)\s+to\s+all.+or\s+-(\d+)\s+to\s+all/);
  if (match) {
    const buffAmount = parseInt(match[1]);
    const debuffAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? buffAmount * 6 : -debuffAmount * 6, // Approximate team effect
      isPositive: isHeads,
      cardTitle,
      effectDescription: `Coin flip: +${buffAmount} or -${debuffAmount} to all`,
    };
  }

  // Dice roll: +1 to +6
  if (lowerDesc.includes("dice roll") && lowerDesc.includes("+1 to +6")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    return {
      type: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      cardTitle,
      effectDescription: "Dice roll: +1 to +6",
    };
  }

  // Dice roll: -3 to +6
  if (lowerDesc.includes("dice roll") && lowerDesc.includes("-3 to +6")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const change = roll <= 3 ? -(4 - roll) : roll - 3; // 1=-3, 2=-2, 3=-1, 4=+1, 5=+2, 6=+3
    return {
      type: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: change > 0,
      cardTitle,
      effectDescription: "Dice roll: -3 to +6",
    };
  }

  // Dice roll: multiplier (0 to 3)
  if (lowerDesc.includes("dice roll") && lowerDesc.includes("multiply")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const multipliers = [0, 0.5, 1, 1.5, 2, 3];
    const mult = multipliers[roll - 1];
    const change = Math.floor(basePoints * mult) - basePoints;
    return {
      type: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: mult >= 1,
      cardTitle,
      effectDescription: `Dice roll: x${mult} multiplier`,
    };
  }

  // Dice roll: effect roulette
  if (lowerDesc.includes("dice roll") && lowerDesc.includes("1=cancel")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const effects = [-999, -5, 0, 3, 6, 10]; // -999 = cancel
    const change = effects[roll - 1];
    return {
      type: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: change > 0,
      cardTitle,
      effectDescription: "Effect roulette",
    };
  }

  // Lucky 7 (double dice)
  if (lowerDesc.includes("roll 2 dice") && lowerDesc.includes("7")) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    const change = total === 7 ? 15 : -3;
    return {
      type: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: change,
      isPositive: total === 7,
      cardTitle,
      effectDescription: "Lucky 7: Roll 7 for +15!",
    };
  }

  // Snake Eyes
  if (lowerDesc.includes("snake eyes") || (lowerDesc.includes("double 1s") && lowerDesc.includes("cancel"))) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const isSnakeEyes = die1 === 1 && die2 === 1;
    return {
      type: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: isSnakeEyes ? 100 : 0, // 100 signals cancel opposite
      isPositive: isSnakeEyes,
      cardTitle,
      effectDescription: "Snake Eyes: Double 1s to cancel!",
    };
  }

  // Boxcars
  if (lowerDesc.includes("boxcars") || (lowerDesc.includes("double 6s") && lowerDesc.includes("+20"))) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const isBoxcars = die1 === 6 && die2 === 6;
    const change = isBoxcars ? 20 : -(die1 + die2);
    return {
      type: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: change,
      isPositive: isBoxcars,
      cardTitle,
      effectDescription: "Boxcars: Double 6s for +20!",
    };
  }

  // All-In Flip
  if (lowerDesc.includes("all-in") || (lowerDesc.includes("x3") && lowerDesc.includes("cancel all"))) {
    const isHeads = Math.random() < 0.5;
    return {
      type: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints * 2 : -998, // -998 signals cancel all own cards
      isPositive: isHeads,
      cardTitle,
      effectDescription: "All-In: x3 or cancel all!",
    };
  }

  // Double dice: difference
  if (lowerDesc.includes("roll 2 dice") && lowerDesc.includes("difference")) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const diff = Math.abs(die1 - die2);
    return {
      type: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: diff,
      isPositive: diff > 0,
      cardTitle,
      effectDescription: "Roll 2 dice: Gain the difference",
    };
  }

  // Random +1 to +5/+10/+15
  match = lowerDesc.match(/randomly\s+gain\s+\+(\d+)\s+to\s+\+(\d+)/);
  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const roll = Math.floor(Math.random() * (max - min + 1)) + min;
    return {
      type: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      cardTitle,
      effectDescription: `Random: +${min} to +${max}`,
    };
  }

  return null;
}
