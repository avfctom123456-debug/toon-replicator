import { useNavigate, useLocation } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";

const PlayComputer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8">
        <img 
          src={gtoonsLogo} 
          alt="gTOONS Remastered" 
          className="w-48 md:w-64 h-auto"
        />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-4">Play Computer</h1>
      <p className="text-muted-foreground mb-8 text-center">
        AI opponent coming soon!
      </p>

      <Button 
        variant="secondary"
        onClick={() => navigate("/home", { state: { username } })}
      >
        Home
      </Button>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">
        v0.0.36
      </div>
    </div>
  );
};

export default PlayComputer;
