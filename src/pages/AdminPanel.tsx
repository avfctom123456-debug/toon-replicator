import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { getCardById } from "@/lib/gameEngine";
import { ArrowLeft, Plus, Trash2, Package, Settings, Pencil, Sparkles, Users, Shield, ShieldOff, Search, Gift, Minus } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

interface UserProfile {
  user_id: string;
  username: string;
  coins: number;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

interface PlayerStats {
  user_id: string;
  elo_rating: number;
  pvp_wins: number;
  pvp_losses: number;
  pvp_draws: number;
  cpu_wins: number;
  win_streak: number;
  best_win_streak: number;
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

  // Users management
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Create pack form
  const [newPackName, setNewPackName] = useState("");
  const [newPackDescription, setNewPackDescription] = useState("");
  const [newPackCost, setNewPackCost] = useState(50);
  const [newPackCardsPerPack, setNewPackCardsPerPack] = useState(2);

  // Add card form
  const [selectedCardId, setSelectedCardId] = useState("");
  const [rarityWeight, setRarityWeight] = useState(100);

  // Give cards form
  const [showGiveCards, setShowGiveCards] = useState(false);
  const [giveCardsUserId, setGiveCardsUserId] = useState("");
  const [giveCardsCardId, setGiveCardsCardId] = useState("");
  const [giveCardsQuantity, setGiveCardsQuantity] = useState(1);
  const [giveCardsSearch, setGiveCardsSearch] = useState("");
  const [givingCards, setGivingCards] = useState(false);

  // Remove cards form
  const [showRemoveCards, setShowRemoveCards] = useState(false);
  const [removeCardsUserId, setRemoveCardsUserId] = useState("");
  const [removeCardsUserCards, setRemoveCardsUserCards] = useState<{ id: string; card_id: number; quantity: number }[]>([]);
  const [removeCardsSearch, setRemoveCardsSearch] = useState("");
  const [loadingUserCards, setLoadingUserCards] = useState(false);
  const [removingCards, setRemovingCards] = useState(false);

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
        fetchUsers();
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, coins, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch all player stats
      const { data: stats, error: statsError } = await supabase
        .from("player_stats")
        .select("user_id, elo_rating, pvp_wins, pvp_losses, pvp_draws, cpu_wins, win_streak, best_win_streak");

      if (statsError) throw statsError;

      setUsers(profiles || []);
      setUserRoles(roles || []);
      setPlayerStats(stats || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getUserStats = (userId: string): PlayerStats | null => {
    return playerStats.find((s) => s.user_id === userId) || null;
  };

  const getUserRole = (userId: string): "admin" | "user" => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || "user";
  };

  const toggleUserAdmin = async (userId: string) => {
    const currentRole = getUserRole(userId);
    
    if (currentRole === "admin") {
      // Remove admin role
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        console.error("Error removing admin:", error);
        toast.error("Failed to remove admin role");
        return;
      }
      toast.success("Admin role removed");
    } else {
      // Add admin role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (error) {
        console.error("Error adding admin:", error);
        toast.error("Failed to add admin role");
        return;
      }
      toast.success("Admin role granted");
    }
    
    fetchUsers();
  };

  const updateUserCoins = async (userId: string, newCoins: number) => {
    const { error } = await supabase
      .from("profiles")
      .update({ coins: newCoins })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating coins:", error);
      toast.error("Failed to update coins");
      return;
    }

    toast.success("Coins updated");
    fetchUsers();
  };

  const updatePlayerStats = async (
    userId: string,
    field: "elo_rating" | "pvp_wins" | "pvp_losses" | "pvp_draws" | "cpu_wins",
    value: number
  ) => {
    // Check if stats exist
    const existingStats = getUserStats(userId);
    
    if (existingStats) {
      const { error } = await supabase
        .from("player_stats")
        .update({ [field]: value })
        .eq("user_id", userId);

      if (error) {
        console.error("Error updating stats:", error);
        toast.error("Failed to update stats");
        return;
      }
    } else {
      // Create new stats record
      const { error } = await supabase
        .from("player_stats")
        .insert({ user_id: userId, [field]: value });

      if (error) {
        console.error("Error creating stats:", error);
        toast.error("Failed to create stats");
        return;
      }
    }

    toast.success("Stats updated");
    fetchUsers();
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.user_id.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredGiveCards = allCards
    .filter((c) => c.title.toLowerCase().includes(giveCardsSearch.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 50);

  const openGiveCardsDialog = (userId: string) => {
    setGiveCardsUserId(userId);
    setGiveCardsCardId("");
    setGiveCardsQuantity(1);
    setGiveCardsSearch("");
    setShowGiveCards(true);
  };

  const handleGiveCards = async () => {
    if (!giveCardsUserId || !giveCardsCardId) return;
    
    setGivingCards(true);
    try {
      // Check if user already has this card
      const { data: existing, error: fetchError } = await supabase
        .from("user_cards")
        .select("id, quantity")
        .eq("user_id", giveCardsUserId)
        .eq("card_id", parseInt(giveCardsCardId))
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from("user_cards")
          .update({ quantity: existing.quantity + giveCardsQuantity })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new card
        const { error } = await supabase
          .from("user_cards")
          .insert({
            user_id: giveCardsUserId,
            card_id: parseInt(giveCardsCardId),
            quantity: giveCardsQuantity,
          });

        if (error) throw error;
      }

      const card = getCardById(parseInt(giveCardsCardId));
      const username = users.find((u) => u.user_id === giveCardsUserId)?.username;
      toast.success(`Gave ${giveCardsQuantity}x ${card?.title || "card"} to ${username}`);
      setShowGiveCards(false);
    } catch (error) {
      console.error("Error giving cards:", error);
      toast.error("Failed to give cards");
    } finally {
      setGivingCards(false);
    }
  };

  const openRemoveCardsDialog = async (userId: string) => {
    setRemoveCardsUserId(userId);
    setRemoveCardsSearch("");
    setShowRemoveCards(true);
    setLoadingUserCards(true);
    
    try {
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, card_id, quantity")
        .eq("user_id", userId);

      if (error) throw error;
      setRemoveCardsUserCards(data || []);
    } catch (error) {
      console.error("Error fetching user cards:", error);
      toast.error("Failed to fetch user cards");
    } finally {
      setLoadingUserCards(false);
    }
  };

  const handleRemoveCard = async (userCardId: string, cardId: number, currentQuantity: number, removeAll: boolean = false) => {
    setRemovingCards(true);
    try {
      const card = getCardById(cardId);
      const username = users.find((u) => u.user_id === removeCardsUserId)?.username;

      if (removeAll || currentQuantity <= 1) {
        // Delete the entire record
        const { error } = await supabase
          .from("user_cards")
          .delete()
          .eq("id", userCardId);

        if (error) throw error;
        toast.success(`Removed all ${card?.title || "card"} from ${username}`);
      } else {
        // Reduce quantity by 1
        const { error } = await supabase
          .from("user_cards")
          .update({ quantity: currentQuantity - 1 })
          .eq("id", userCardId);

        if (error) throw error;
        toast.success(`Removed 1x ${card?.title || "card"} from ${username}`);
      }

      // Refresh the user cards list
      const { data, error } = await supabase
        .from("user_cards")
        .select("id, card_id, quantity")
        .eq("user_id", removeCardsUserId);

      if (error) throw error;
      setRemoveCardsUserCards(data || []);
    } catch (error) {
      console.error("Error removing card:", error);
      toast.error("Failed to remove card");
    } finally {
      setRemovingCards(false);
    }
  };

  const filteredRemoveCards = removeCardsUserCards
    .filter((uc) => {
      const card = getCardById(uc.card_id);
      return card?.title.toLowerCase().includes(removeCardsSearch.toLowerCase());
    })
    .sort((a, b) => {
      const cardA = getCardById(a.card_id);
      const cardB = getCardById(b.card_id);
      return (cardA?.title || "").localeCompare(cardB?.title || "");
    });

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

        <Tabs defaultValue="packs" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="packs" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Packs
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packs">
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
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manage Users
                </CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <p className="text-muted-foreground text-center py-4">Loading users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No users found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Coins</TableHead>
                          <TableHead>ELO</TableHead>
                          <TableHead>PVP W/L/D</TableHead>
                          <TableHead>CPU Wins</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => {
                          const isUserAdmin = getUserRole(u.user_id) === "admin";
                          const isCurrentUser = u.user_id === user?.id;
                          const stats = getUserStats(u.user_id);

                          return (
                            <TableRow key={u.user_id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{u.username}</span>
                                  {isCurrentUser && (
                                    <Badge variant="outline" className="text-xs">You</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {isUserAdmin ? (
                                  <Badge className="bg-primary">Admin</Badge>
                                ) : (
                                  <Badge variant="secondary">User</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={u.coins}
                                  onChange={(e) =>
                                    updateUserCoins(u.user_id, parseInt(e.target.value) || 0)
                                  }
                                  className="w-20"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={stats?.elo_rating || 1000}
                                  onChange={(e) =>
                                    updatePlayerStats(u.user_id, "elo_rating", parseInt(e.target.value) || 1000)
                                  }
                                  className="w-20"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={stats?.pvp_wins || 0}
                                    onChange={(e) =>
                                      updatePlayerStats(u.user_id, "pvp_wins", parseInt(e.target.value) || 0)
                                    }
                                    className="w-14"
                                    min={0}
                                    title="Wins"
                                  />
                                  <span className="text-muted-foreground">/</span>
                                  <Input
                                    type="number"
                                    value={stats?.pvp_losses || 0}
                                    onChange={(e) =>
                                      updatePlayerStats(u.user_id, "pvp_losses", parseInt(e.target.value) || 0)
                                    }
                                    className="w-14"
                                    min={0}
                                    title="Losses"
                                  />
                                  <span className="text-muted-foreground">/</span>
                                  <Input
                                    type="number"
                                    value={stats?.pvp_draws || 0}
                                    onChange={(e) =>
                                      updatePlayerStats(u.user_id, "pvp_draws", parseInt(e.target.value) || 0)
                                    }
                                    className="w-14"
                                    min={0}
                                    title="Draws"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={stats?.cpu_wins || 0}
                                  onChange={(e) =>
                                    updatePlayerStats(u.user_id, "cpu_wins", parseInt(e.target.value) || 0)
                                  }
                                  className="w-16"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(u.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openGiveCardsDialog(u.user_id)}
                                  >
                                    <Gift className="h-4 w-4 mr-1" />
                                    Give
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openRemoveCardsDialog(u.user_id)}
                                  >
                                    <Minus className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                  <Button
                                    variant={isUserAdmin ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => toggleUserAdmin(u.user_id)}
                                    disabled={isCurrentUser}
                                    title={isCurrentUser ? "Cannot modify your own role" : ""}
                                  >
                                    {isUserAdmin ? (
                                      <>
                                        <ShieldOff className="h-4 w-4 mr-1" />
                                        Revoke
                                      </>
                                    ) : (
                                      <>
                                        <Shield className="h-4 w-4 mr-1" />
                                        Admin
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Give Cards Dialog */}
        <Dialog open={showGiveCards} onOpenChange={setShowGiveCards}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Give Cards to {users.find((u) => u.user_id === giveCardsUserId)?.username}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Search Card</Label>
                <Input
                  value={giveCardsSearch}
                  onChange={(e) => setGiveCardsSearch(e.target.value)}
                  placeholder="Search by card name..."
                />
              </div>
              <div>
                <Label>Select Card</Label>
                <Select value={giveCardsCardId} onValueChange={setGiveCardsCardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a card" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredGiveCards.map((card) => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        #{card.id} - {card.title} ({card.rarity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={giveCardsQuantity}
                  onChange={(e) => setGiveCardsQuantity(parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <Button
                onClick={handleGiveCards}
                className="w-full"
                disabled={!giveCardsCardId || givingCards}
              >
                {givingCards ? "Giving..." : "Give Cards"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Cards Dialog */}
        <Dialog open={showRemoveCards} onOpenChange={setShowRemoveCards}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Remove Cards from {users.find((u) => u.user_id === removeCardsUserId)?.username}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Search Card</Label>
                <Input
                  value={removeCardsSearch}
                  onChange={(e) => setRemoveCardsSearch(e.target.value)}
                  placeholder="Search by card name..."
                />
              </div>
              {loadingUserCards ? (
                <p className="text-muted-foreground text-center py-4">Loading cards...</p>
              ) : filteredRemoveCards.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {removeCardsSearch ? "No matching cards found" : "User has no cards"}
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {filteredRemoveCards.map((uc) => {
                    const card = getCardById(uc.card_id);
                    return (
                      <div
                        key={uc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div>
                          <p className="font-medium">{card?.title || `Card #${uc.card_id}`}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {uc.quantity} • {card?.rarity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveCard(uc.id, uc.card_id, uc.quantity, false)}
                            disabled={removingCards}
                          >
                            <Minus className="h-4 w-4 mr-1" />
                            -1
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveCard(uc.id, uc.card_id, uc.quantity, true)}
                            disabled={removingCards}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            All
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
