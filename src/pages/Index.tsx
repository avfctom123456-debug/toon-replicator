import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shuffle } from "lucide-react";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const adjectives1 = [
  "Emotional", "Brave", "Swift", "Mighty", "Silent", "Fierce", "Gentle", "Noble", 
  "Wild", "Calm", "Bold", "Clever", "Ancient", "Mystic", "Cosmic", "Golden"
];

const adjectives2 = [
  "Wise", "Dark", "Light", "Storm", "Thunder", "Shadow", "Flame", "Frost",
  "Iron", "Crystal", "Lunar", "Solar", "Chaos", "Order", "Dream", "Void"
];

const nouns = [
  "Trick", "Knight", "Wizard", "Dragon", "Phoenix", "Warrior", "Hunter", "Sage",
  "Wolf", "Raven", "Tiger", "Bear", "Lion", "Eagle", "Serpent", "Fox"
];

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const Index = () => {
  const navigate = useNavigate();
  const [word1, setWord1] = useState(adjectives1[0]);
  const [word2, setWord2] = useState(adjectives2[0]);
  const [word3, setWord3] = useState(nouns[0]);

  const handleShuffle = useCallback(() => {
    setWord1(getRandomItem(adjectives1));
    setWord2(getRandomItem(adjectives2));
    setWord3(getRandomItem(nouns));
  }, []);

  const handleOk = useCallback(() => {
    const username = `${word1} ${word2} ${word3}`;
    navigate("/home", { state: { username } });
  }, [word1, word2, word3, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-12">
        <img 
          src={gtoonsLogo} 
          alt="gTOONS Remastered" 
          className="w-64 md:w-80 h-auto"
        />
      </div>

      {/* Username Selection */}
      <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
        <h2 className="text-foreground text-lg font-medium">Select a username</h2>
        
        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Select value={word1} onValueChange={setWord1}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adjectives1.map((adj) => (
                <SelectItem key={adj} value={adj}>
                  {adj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={word2} onValueChange={setWord2}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adjectives2.map((adj) => (
                <SelectItem key={adj} value={adj}>
                  {adj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={word3} onValueChange={setWord3}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nouns.map((noun) => (
                <SelectItem key={noun} value={noun}>
                  {noun}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-2">
          <Button variant="ghost" onClick={handleShuffle} className="text-muted-foreground hover:text-foreground">
            Shuffle <Shuffle className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={handleOk} className="px-8">
            OK
          </Button>
        </div>
      </div>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">
        v0.0.36
      </div>
    </div>
  );
};

export default Index;
