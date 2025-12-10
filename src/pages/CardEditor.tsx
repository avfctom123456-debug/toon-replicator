import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Upload, X, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCardOverrides } from "@/hooks/useCardOverrides";
import { toast } from "sonner";
import cardsData from "@/data/cards.json";

interface CardData {
  id: number;
  title: string;
  character: string;
  basePoints: number;
  points: number;
  colors: string[];
  description: string;
  rarity: string;
  groups: string[];
  types: string[];
}

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal/released";

const colorBg: Record<string, string> = {
  SILVER: "bg-gray-400",
  BLUE: "bg-blue-500",
  BLACK: "bg-gray-800",
  GREEN: "bg-green-500",
  PURPLE: "bg-purple-500",
  RED: "bg-red-500",
  ORANGE: "bg-orange-500",
  YELLOW: "bg-yellow-500",
  PINK: "bg-pink-500",
  WHITE: "bg-white",
};

const allCards = cardsData as CardData[];

export default function CardEditor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { overrides, getOverride, upsertOverride, deleteOverride, uploadCardImage, loading: overridesLoading } = useCardOverrides();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [editForm, setEditForm] = useState({
    custom_title: "",
    custom_description: "",
    custom_base_points: "",
    custom_image_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredCards = useMemo(() => {
    let cards = [...allCards].sort((a, b) => a.title.localeCompare(b.title));
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      cards = cards.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.character.toLowerCase().includes(query) ||
          card.id.toString() === query
      );
    }
    return cards;
  }, [searchQuery]);

  const selectCard = (card: CardData) => {
    setSelectedCard(card);
    const override = getOverride(card.id);
    setEditForm({
      custom_title: override?.custom_title || "",
      custom_description: override?.custom_description || "",
      custom_base_points: override?.custom_base_points?.toString() || "",
      custom_image_url: override?.custom_image_url || "",
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCard || !e.target.files?.[0]) return;

    setUploading(true);
    const file = e.target.files[0];
    const url = await uploadCardImage(selectedCard.id, file);

    if (url) {
      setEditForm((prev) => ({ ...prev, custom_image_url: url }));
      toast.success("Image uploaded");
    } else {
      toast.error("Failed to upload image");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!selectedCard) return;

    setSaving(true);
    const success = await upsertOverride(selectedCard.id, {
      custom_title: editForm.custom_title || null,
      custom_description: editForm.custom_description || null,
      custom_base_points: editForm.custom_base_points ? parseInt(editForm.custom_base_points) : null,
      custom_image_url: editForm.custom_image_url || null,
    });

    if (success) {
      toast.success("Card override saved");
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedCard) return;

    const success = await deleteOverride(selectedCard.id);
    if (success) {
      toast.success("Override deleted");
      setEditForm({
        custom_title: "",
        custom_description: "",
        custom_base_points: "",
        custom_image_url: "",
      });
    } else {
      toast.error("Failed to delete");
    }
  };

  const getCardImageUrl = (card: CardData) => {
    const override = getOverride(card.id);
    return override?.custom_image_url || `${IMAGE_BASE_URL}/${card.id}.jpg`;
  };

  if (authLoading || roleLoading || overridesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Admin access required</p>
        <Link to="/home">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Card Editor</h1>
            <p className="text-sm text-muted-foreground">
              {overrides.length} cards with custom overrides
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card List */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cards by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="bg-card rounded-lg border border-border max-h-[600px] overflow-y-auto">
            {filteredCards.map((card) => {
              const hasOverride = !!getOverride(card.id);
              const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";

              return (
                <div
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50 border-b border-border last:border-b-0 ${
                    selectedCard?.id === card.id ? "bg-accent/20" : ""
                  }`}
                >
                  <CardImage card={card} bgColor={bgColor} imageUrl={getCardImageUrl(card)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{card.title}</h3>
                      {hasOverride && (
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">
                          Modified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ID: {card.id} • {card.basePoints} pts • {card.rarity}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-card rounded-lg border border-border p-6 h-fit sticky top-4">
          {selectedCard ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedCard.title}</h2>
                  <p className="text-muted-foreground">Card ID: {selectedCard.id}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCard(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Current Image */}
              <div className="space-y-2">
                <Label>Card Image</Label>
                <div className="flex items-start gap-4">
                  <CardImage
                    card={selectedCard}
                    bgColor={colorBg[selectedCard.colors?.[0]] || "bg-gray-500"}
                    imageUrl={editForm.custom_image_url || `${IMAGE_BASE_URL}/${selectedCard.id}.jpg`}
                    size="large"
                  />
                  <div className="space-y-2 flex-1">
                    <Input
                      placeholder="Custom image URL"
                      value={editForm.custom_image_url}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, custom_image_url: e.target.value }))
                      }
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      <Button variant="outline" className="w-full" disabled={uploading}>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Uploading..." : "Upload Image"}
                      </Button>
                    </div>
                    {editForm.custom_image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditForm((prev) => ({ ...prev, custom_image_url: "" }))}
                      >
                        Clear custom image
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Title Override */}
              <div className="space-y-2">
                <Label>Custom Title</Label>
                <Input
                  placeholder={selectedCard.title}
                  value={editForm.custom_title}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, custom_title: e.target.value }))
                  }
                />
              </div>

              {/* Description Override */}
              <div className="space-y-2">
                <Label>Custom Description</Label>
                <Textarea
                  placeholder={selectedCard.description}
                  value={editForm.custom_description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, custom_description: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              {/* Points Override */}
              <div className="space-y-2">
                <Label>Custom Base Points</Label>
                <Input
                  type="number"
                  placeholder={selectedCard.basePoints.toString()}
                  value={editForm.custom_base_points}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, custom_base_points: e.target.value }))
                  }
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Override"}
                </Button>
                {getOverride(selectedCard.id) && (
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Original Values */}
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Original Values</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>Title: {selectedCard.title}</p>
                  <p>Description: {selectedCard.description}</p>
                  <p>Base Points: {selectedCard.basePoints}</p>
                  <p>Colors: {selectedCard.colors.join(", ")}</p>
                  <p>Types: {selectedCard.types.join(", ")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select a card to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardImage({
  card,
  bgColor,
  imageUrl,
  size = "small",
}: {
  card: CardData;
  bgColor: string;
  imageUrl: string;
  size?: "small" | "large";
}) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = size === "large" ? "w-24 h-24" : "w-12 h-12";

  return (
    <div className={`${sizeClass} rounded-lg ${bgColor} overflow-hidden flex-shrink-0 flex items-center justify-center`}>
      {!imageError ? (
        <img
          src={imageUrl}
          alt={card.title}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-white font-bold text-xl">{card.title[0]}</span>
      )}
    </div>
  );
}
