import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useFriends";
import { useChallenges } from "@/hooks/useChallenges";
import { useDecks } from "@/hooks/useDecks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  UserPlus, 
  Check, 
  X, 
  Swords, 
  UserMinus, 
  Search,
  Users,
  Clock,
  Shield
} from "lucide-react";

interface UserSearchResult {
  user_id: string;
  username: string;
}

const Friends = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { friends, pendingRequests, loading: friendsLoading, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, isFriend } = useFriends();
  const { incomingChallenges, sendChallenge } = useChallenges();
  const { decks } = useDecks();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username")
      .ilike("username", `%${searchQuery}%`)
      .neq("user_id", user.id)
      .limit(10);
    
    if (error) {
      toast.error("Failed to search users");
      setSearching(false);
      return;
    }
    
    setSearchResults(data || []);
    setSearching(false);
  };

  const handleSendFriendRequest = async (userId: string, username: string) => {
    const success = await sendFriendRequest(userId);
    if (success) {
      toast.success(`Friend request sent to ${username}`);
      setSearchResults(prev => prev.filter(u => u.user_id !== userId));
    } else {
      toast.error("Failed to send friend request");
    }
  };

  const handleAcceptRequest = async (friendshipId: string, username: string) => {
    const success = await acceptFriendRequest(friendshipId);
    if (success) {
      toast.success(`You are now friends with ${username}`);
    } else {
      toast.error("Failed to accept friend request");
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    const success = await declineFriendRequest(friendshipId);
    if (success) {
      toast.success("Friend request declined");
    } else {
      toast.error("Failed to decline friend request");
    }
  };

  const handleRemoveFriend = async (friendshipId: string, username: string) => {
    const success = await removeFriend(friendshipId);
    if (success) {
      toast.success(`Removed ${username} from friends`);
    } else {
      toast.error("Failed to remove friend");
    }
  };

  const handleSendChallenge = async (friendUserId: string, username: string) => {
    if (!selectedDeckId) {
      toast.error("Please select a deck first");
      return;
    }
    
    const deck = decks.find(d => d.id === selectedDeckId);
    if (!deck || deck.card_ids.length !== 7) {
      toast.error("Please select a valid deck with 7 cards");
      return;
    }
    
    const success = await sendChallenge(friendUserId, deck.card_ids);
    if (success) {
      toast.success(`Challenge sent to ${username}`);
    } else {
      toast.error("Failed to send challenge");
    }
  };

  if (authLoading || friendsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const validDecks = decks.filter(d => d.card_ids.length === 7);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
      </div>

      <Tabs defaultValue="friends" className="w-full max-w-2xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add
          </TabsTrigger>
        </TabsList>

        {/* Friends List */}
        <TabsContent value="friends">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Your Friends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deck Selection for Challenges */}
              {validDecks.length > 0 && (
                <div className="p-3 bg-secondary/30 rounded-lg border border-border/30 mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Select deck for challenges:</label>
                  <select
                    value={selectedDeckId || ""}
                    onChange={(e) => setSelectedDeckId(e.target.value || null)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Choose a deck...</option>
                    {validDecks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        Deck {deck.slot.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {friends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No friends yet. Add some friends to play with!
                </p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">
                        {friend.friend_username || "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendChallenge(
                          friend.user_id === user.id ? friend.friend_id : friend.user_id,
                          friend.friend_username || "friend"
                        )}
                        disabled={!selectedDeckId}
                        className="flex items-center gap-1"
                      >
                        <Swords className="h-4 w-4" />
                        Challenge
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFriend(friend.id, friend.friend_username || "friend")}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Requests */}
        <TabsContent value="requests">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Pending Friend Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No pending friend requests.
                </p>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-500" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">
                          {request.requester_username || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Wants to be your friend
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAcceptRequest(request.id, request.requester_username || "user")}
                        className="flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeclineRequest(request.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Friends */}
        <TabsContent value="add">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Find Players</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Search Results:</p>
                  {searchResults.map((result) => (
                    <div
                      key={result.user_id}
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">
                          {result.username}
                        </span>
                      </div>
                      {isFriend(result.user_id) ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Friends
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendFriendRequest(result.user_id, result.username)}
                          className="flex items-center gap-1"
                        >
                          <UserPlus className="h-4 w-4" />
                          Add Friend
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <p className="text-muted-foreground text-center py-4">
                  No players found matching "{searchQuery}"
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Friends;
