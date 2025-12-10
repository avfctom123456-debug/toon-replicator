import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DailyEarningsProgress } from "@/components/DailyEarningsProgress";

const Lobby = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 gap-4">
      {/* Daily Earnings Progress */}
      <DailyEarningsProgress />

      {/* Lobby Section */}
      <section>
        <h2 className="text-2xl font-bold text-primary mb-2">Lobby</h2>
        <div className="bg-card rounded-lg p-4 min-h-[120px]">
          <p className="text-foreground font-medium">{username}</p>
        </div>
      </section>

      {/* Challenges Section */}
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-2">Challenges</h2>
        <div className="bg-card rounded-lg p-4 min-h-[80px]">
          {/* Empty for now */}
        </div>
      </section>

      {/* Chat Section */}
      <section className="flex-1 flex flex-col">
        <h2 className="text-2xl font-bold text-foreground mb-2">Chat</h2>
        <div className="bg-card rounded-lg p-4 flex-1 min-h-[150px] mb-3">
          {/* Chat messages would go here */}
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary">
            Send
          </Button>
        </div>
      </section>

      {/* Home Button */}
      <div className="flex justify-center pt-2">
        <Button 
          variant="secondary"
          onClick={() => navigate("/home", { state: { username } })}
        >
          Home
        </Button>
      </div>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">
        v0.0.36
      </div>
    </div>
  );
};

export default Lobby;
