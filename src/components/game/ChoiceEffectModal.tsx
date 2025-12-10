import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Target, Shield } from "lucide-react";

export interface ChoiceOption {
  label: string;
  description: string;
  value: string;
  icon?: "buff" | "debuff" | "special" | "cancel";
}

export interface ChoiceEffectData {
  cardTitle: string;
  cardPosition: number;
  isPlayer: boolean;
  options: ChoiceOption[];
  effectType: string;
}

interface ChoiceEffectModalProps {
  isOpen: boolean;
  choiceData: ChoiceEffectData | null;
  onChoice: (choice: string) => void;
}

const iconMap = {
  buff: <Sparkles className="w-5 h-5 text-green-400" />,
  debuff: <Target className="w-5 h-5 text-red-400" />,
  special: <Zap className="w-5 h-5 text-yellow-400" />,
  cancel: <Shield className="w-5 h-5 text-cyan-400" />,
};

export default function ChoiceEffectModal({ isOpen, choiceData, onChoice }: ChoiceEffectModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSelect = (value: string) => {
    setSelectedOption(value);
  };

  const handleConfirm = () => {
    if (selectedOption) {
      setIsConfirming(true);
      setTimeout(() => {
        onChoice(selectedOption);
        setSelectedOption(null);
        setIsConfirming(false);
      }, 500);
    }
  };

  if (!choiceData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Choose Your Effect
              </div>
              <div className="text-sm text-muted-foreground">
                {choiceData.cardTitle}
              </div>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <AnimatePresence mode="wait">
            {choiceData.options.map((option, index) => (
              <motion.div
                key={option.value}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Button
                  variant="outline"
                  className={`w-full h-auto p-4 flex flex-col items-start gap-2 transition-all ${
                    selectedOption === option.value
                      ? "border-cyan-400 bg-cyan-400/10 ring-2 ring-cyan-400/50"
                      : "border-border/50 hover:border-purple-400/50 hover:bg-purple-400/5"
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {option.icon && iconMap[option.icon]}
                    <span className="font-semibold text-foreground">{option.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    {option.description}
                  </span>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            className={`w-full transition-all ${
              selectedOption
                ? "bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                : "bg-muted text-muted-foreground"
            }`}
            disabled={!selectedOption || isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5" />
              </motion.div>
            ) : (
              "Activate Effect"
            )}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// Parse a choice effect from card description
export function parseChoiceEffect(
  description: string,
  cardTitle: string,
  cardPosition: number,
  isPlayer: boolean
): ChoiceEffectData | null {
  const desc = description.toLowerCase();
  
  // "Choose one: +X or +Y for each [type]"
  let match = desc.match(/choose\s+one:\s*\+(\d+)\s+or\s+\+(\d+)\s+for\s+each\s+(.+?)(?:\s+in\s+play)?$/);
  if (match) {
    return {
      cardTitle,
      cardPosition,
      isPlayer,
      effectType: "choose-bonus-or-scaling",
      options: [
        {
          label: `+${match[1]} Points`,
          description: "Add flat bonus to this card",
          value: `flat:${match[1]}`,
          icon: "buff",
        },
        {
          label: `+${match[2]} per ${match[3]}`,
          description: `Gain +${match[2]} for each ${match[3]} in play`,
          value: `scaling:${match[2]}:${match[3]}`,
          icon: "special",
        },
      ],
    };
  }

  // "Choose one: +X to this card or -X to opposite"
  match = desc.match(/choose\s+one:\s*\+(\d+)\s+to\s+this\s+card\s+or\s+-(\d+)\s+to\s+opposite/);
  if (match) {
    return {
      cardTitle,
      cardPosition,
      isPlayer,
      effectType: "choose-buff-or-debuff",
      options: [
        {
          label: `+${match[1]} to Self`,
          description: "Buff this card's points",
          value: `self:${match[1]}`,
          icon: "buff",
        },
        {
          label: `-${match[2]} to Opposite`,
          description: "Debuff the opposing card",
          value: `opposite:-${match[2]}`,
          icon: "debuff",
        },
      ],
    };
  }

  // "Choose one: cancel opposite or double this card"
  if (desc.includes("choose one") && desc.includes("cancel") && desc.includes("double")) {
    return {
      cardTitle,
      cardPosition,
      isPlayer,
      effectType: "choose-cancel-or-double",
      options: [
        {
          label: "Cancel Opposite",
          description: "Nullify the opposing card entirely",
          value: "cancel-opposite",
          icon: "cancel",
        },
        {
          label: "Double Points",
          description: "Double this card's current points",
          value: "double-self",
          icon: "buff",
        },
      ],
    };
  }

  // "Choose one: +X to neighbors or +Y to all [type]"
  match = desc.match(/choose\s+one:\s*\+(\d+)\s+to\s+neighbors\s+or\s+\+(\d+)\s+to\s+all\s+(.+)/);
  if (match) {
    return {
      cardTitle,
      cardPosition,
      isPlayer,
      effectType: "choose-neighbor-or-type",
      options: [
        {
          label: `+${match[1]} to Neighbors`,
          description: "Buff adjacent cards",
          value: `neighbors:${match[1]}`,
          icon: "buff",
        },
        {
          label: `+${match[2]} to all ${match[3]}`,
          description: `Buff all ${match[3]} cards`,
          value: `type:${match[2]}:${match[3]}`,
          icon: "special",
        },
      ],
    };
  }

  // Generic "Activate one:" pattern
  match = desc.match(/activate\s+one:\s*(.+?)\s+or\s+(.+)/);
  if (match) {
    return {
      cardTitle,
      cardPosition,
      isPlayer,
      effectType: "choose-generic",
      options: [
        {
          label: "Option A",
          description: match[1],
          value: `optionA:${match[1]}`,
          icon: "special",
        },
        {
          label: "Option B",
          description: match[2],
          value: `optionB:${match[2]}`,
          icon: "special",
        },
      ],
    };
  }

  return null;
}

// Check if a card has a choice effect
export function hasChoiceEffect(description: string): boolean {
  const desc = description.toLowerCase();
  return desc.includes("choose one:") || desc.includes("activate one:");
}
