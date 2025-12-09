import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { getCardById } from "@/lib/gameEngine";
import { ArrowLeft, Plus, Trash2, Package, Settings, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import cardsData from "@/data/cards.json";

interface Pack {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  cards_per_pack: number;
  is_active: boolean;
}

interface PackCard {
  id: string;
  pack_id: string;
  card_id: number;
  rarity_weight: number;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [packCards, setPackCards] = useState<PackCard[]>([]);
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  // Create pack form
  const [newPackName, setNewPackName] = useState("");
  const [newPackDescription, setNewPackDescription] = useState("");
  const [newPackCost, setNewPackCost] = useState(50);
  const [newPackCardsPerPack, setNewPackCardsPerPack] = useState(2);

  // Add card form
  const [selectedCardId, setSelectedCardId] = useState("");
  const [rarityWeight, setRarityWeight] = useState(100);

  const allCards = cardsData as { id: number; title: string; rarity: string }[];

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate("/auth");
      } else if (!isAdmin) {
        navigate("/");
        toast.error("Admin access required");
      } else {
        fetchPacks();
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const fetchPacks = async () => {
    const { data, error } = await supabase
      .from("packs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching packs:", error);
      return;
    }
    setPacks(data || []);
  };

  const fetchPackCards = async (packId: string) => {
    const { data, error } = await supabase
      .from("pack_cards")
      .select("*")
      .eq("pack_id", packId)
      .order("rarity_weight", { ascending: false });

    if (error) {
      console.error("Error fetching pack cards:", error);
      return;
    }
    setPackCards(data || []);
  };

  const handleSelectPack = (pack: Pack) => {
    setSelectedPack(pack);
    fetchPackCards(pack.id);
  };

  const handleCreatePack = async () => {
    const { error } = await supabase.from("packs").insert({
      name: newPackName,
      description: newPackDescription || null,
      cost: newPackCost,
      cards_per_pack: newPackCardsPerPack,
    });

    if (error) {
      console.error("Error creating pack:", error);
      toast.error("Failed to create pack");
      return;
    }

    toast.success("Pack created!");
    setShowCreatePack(false);
    setNewPackName("");
    setNewPackDescription("");
    setNewPackCost(50);
    setNewPackCardsPerPack(2);
    fetchPacks();
  };

  const handleTogglePackActive = async (pack: Pack) => {
    const { error } = await supabase
      .from("packs")
      .update({ is_active: !pack.is_active })
      .eq("id", pack.id);

    if (error) {
      console.error("Error toggling pack:", error);
      toast.error("Failed to update pack");
      return;
    }

    fetchPacks();
    if (selectedPack?.id === pack.id) {
      setSelectedPack({ ...pack, is_active: !pack.is_active });
    }
  };

  const handleDeletePack = async (packId: string) => {
    const { error } = await supabase.from("packs").delete().eq("id", packId);

    if (error) {
      console.error("Error deleting pack:", error);
      toast.error("Failed to delete pack");
      return;
    }

    toast.success("Pack deleted");
    if (selectedPack?.id === packId) {
      setSelectedPack(null);
      setPackCards([]);
    }
    fetchPacks();
  };

  const handleAddCardToPack = async () => {
    if (!selectedPack || !selectedCardId) return;

    const { error } = await supabase.from("pack_cards").insert({
      pack_id: selectedPack.id,
      card_id: parseInt(selectedCardId),
      rarity_weight: rarityWeight,
    });

    if (error) {
      console.error("Error adding card:", error);
      toast.error("Failed to add card");
      return;
    }

    toast.success("Card added to pack!");
    setShowAddCard(false);
    setSelectedCardId("");
    setRarityWeight(100);
    fetchPackCards(selectedPack.id);
  };

  const handleRemoveCardFromPack = async (packCardId: string) => {
    const { error } = await supabase.from("pack_cards").delete().eq("id", packCardId);

    if (error) {
      console.error("Error removing card:", error);
      toast.error("Failed to remove card");
      return;
    }

    toast.success("Card removed");
    if (selectedPack) {
      fetchPackCards(selectedPack.id);
    }
  };

  const handleUpdateWeight = async (packCardId: string, newWeight: number) => {
    const { error } = await supabase
      .from("pack_cards")
      .update({ rarity_weight: newWeight })
      .eq("id", packCardId);

    if (error) {
      console.error("Error updating weight:", error);
      toast.error("Failed to update weight");
      return;
    }

    if (selectedPack) {
      fetchPackCards(selectedPack.id);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Admin Panel
          </h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/card-creator")} variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Create Cards
            </Button>
            <Button onClick={() => navigate("/card-editor")}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Cards
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Packs List */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Card Packs
              </CardTitle>
              <Dialog open={showCreatePack} onOpenChange={setShowCreatePack}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Pack
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Pack</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Pack Name</Label>
                      <Input
                        value={newPackName}
                        onChange={(e) => setNewPackName(e.target.value)}
                        placeholder="Series 2 Booster"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={newPackDescription}
                        onChange={(e) => setNewPackDescription(e.target.value)}
                        placeholder="Contains cards from Series 2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Cost (coins)</Label>
                        <Input
                          type="number"
                          value={newPackCost}
                          onChange={(e) => setNewPackCost(parseInt(e.target.value) || 0)}
                          min={0}
                        />
                      </div>
                      <div>
                        <Label>Cards per Pack</Label>
                        <Input
                          type="number"
                          value={newPackCardsPerPack}
                          onChange={(e) => setNewPackCardsPerPack(parseInt(e.target.value) || 1)}
                          min={1}
                        />
                      </div>
                    </div>
                    <Button onClick={handleCreatePack} className="w-full" disabled={!newPackName}>
                      Create Pack
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {packs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No packs created yet</p>
              ) : (
                <div className="space-y-2">
                  {packs.map((pack) => (
                    <div
                      key={pack.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPack?.id === pack.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleSelectPack(pack)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{pack.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {pack.cost} coins • {pack.cards_per_pack} cards
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={pack.is_active}
                            onCheckedChange={() => handleTogglePackActive(pack)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePack(pack.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pack Cards */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedPack ? `Cards in "${selectedPack.name}"` : "Select a Pack"}
              </CardTitle>
              {selectedPack && (
                <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Card
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Card to Pack</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Card</Label>
                        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a card" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {allCards.map((card) => (
                              <SelectItem key={card.id} value={card.id.toString()}>
                                {card.title} ({card.rarity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Rarity Weight (higher = more common)</Label>
                        <Input
                          type="number"
                          value={rarityWeight}
                          onChange={(e) => setRarityWeight(parseInt(e.target.value) || 1)}
                          min={1}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Common: 100, Uncommon: 50, Rare: 25, Very Rare: 10, Slam: 5
                        </p>
                      </div>
                      <Button
                        onClick={handleAddCardToPack}
                        className="w-full"
                        disabled={!selectedCardId}
                      >
                        Add Card
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!selectedPack ? (
                <p className="text-muted-foreground text-center py-4">
                  Select a pack to manage its cards
                </p>
              ) : packCards.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No cards in this pack yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packCards.map((pc) => {
                      const card = getCardById(pc.card_id);
                      return (
                        <TableRow key={pc.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{card?.title || `Card ${pc.card_id}`}</p>
                              <p className="text-xs text-muted-foreground">{card?.rarity}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={pc.rarity_weight}
                              onChange={(e) =>
                                handleUpdateWeight(pc.id, parseInt(e.target.value) || 1)
                              }
                              className="w-20"
                              min={1}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCardFromPack(pc.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
