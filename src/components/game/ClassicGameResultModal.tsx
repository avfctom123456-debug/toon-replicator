import { useNavigate } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";

interface ClassicGameResultModalProps {
  isOpen: boolean;
  winner: "player" | "opponent" | "tie" | null;
  winMethod: string;
  playerScore: number;
  opponentScore: number;
  onReview: () => void;
  reverseScoring?: boolean;
}

export const ClassicGameResultModal = ({
  isOpen,
  winner,
  winMethod,
  playerScore,
  opponentScore,
  onReview,
  reverseScoring = false,
}: ClassicGameResultModalProps) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getTitle = () => {
    if (winner === "player") return "Congratulations!";
    if (winner === "opponent") return "Defeat!";
    return "It's a Tie!";
  };

  const getSubtitle = () => {
    if (winner === "tie") return "Match Drawn";
    const method = reverseScoring && winMethod === "points" 
      ? "Lowest Points" 
      : winMethod.charAt(0).toUpperCase() + winMethod.slice(1);
    return `Winner by ${method}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Modal */}
      <div 
        className="relative bg-gradient-to-b from-[hsl(200,25%,85%)] to-[hsl(200,30%,75%)] rounded-lg shadow-2xl border-2 border-[hsl(200,40%,60%)] overflow-hidden animate-scale-in"
        style={{ minWidth: "280px", maxWidth: "340px" }}
      >
        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[hsl(200,50%,50%)] via-[hsl(200,60%,60%)] to-[hsl(200,50%,50%)]" />
        
        <div className="p-6 text-center">
          {/* Title */}
          <h2 
            className="text-3xl font-bold italic mb-2"
            style={{ 
              color: winner === "player" ? "hsl(200,60%,30%)" : winner === "opponent" ? "hsl(0,50%,40%)" : "hsl(200,40%,40%)",
              textShadow: "0 1px 2px rgba(255,255,255,0.5)"
            }}
          >
            {getTitle()}
          </h2>
          
          {/* Subtitle - Win Method */}
          <p className="text-[hsl(200,30%,40%)] text-lg mb-2 flex items-center justify-center gap-2">
            {reverseScoring && <ArrowDownUp className="w-4 h-4 text-purple-600" />}
            {getSubtitle()}
            {reverseScoring && <ArrowDownUp className="w-4 h-4 text-purple-600" />}
          </p>
          
          {/* Reverse Scoring Notice */}
          {reverseScoring && (
            <div className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full mb-3 inline-flex items-center gap-1">
              <ArrowDownUp className="w-3 h-3" />
              Reverse Scoring Active
            </div>
          )}

          {/* Score Display */}
          <div className="flex justify-center items-center gap-4 mb-6 text-[hsl(200,40%,35%)]">
            <span className="text-xl font-bold">{playerScore}</span>
            <span className="text-sm">vs</span>
            <span className="text-xl font-bold">{opponentScore}</span>
          </div>
          
          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/")}
              className="w-full py-2.5 px-6 bg-gradient-to-b from-[hsl(200,35%,70%)] to-[hsl(200,40%,60%)] hover:from-[hsl(200,40%,75%)] hover:to-[hsl(200,45%,65%)] text-[hsl(200,50%,25%)] font-semibold rounded border border-[hsl(200,30%,55%)] shadow-md transition-all"
            >
              Home
            </button>
            <button
              onClick={onReview}
              className="w-full py-2.5 px-6 bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,65%)] hover:from-[hsl(200,35%,80%)] hover:to-[hsl(200,40%,70%)] text-[hsl(200,40%,30%)] font-semibold rounded border border-[hsl(200,25%,60%)] shadow-md transition-all"
            >
              Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
