import { useState, useEffect, useCallback } from "react";
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
  Shield,
  Send
} from "lucide-react";

interface UserSearchResult {
  user_id: string;
  username: string;
}

const Friends = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { friends, pendingRequests, loading: friendsLoading, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, isFriend } = useFriends();
  
  // Handle challenge accepted - navigate to match
  const handleChallengeAccepted = useCallback((matchId: string) => {
    toast.success("Your challenge was accepted! Starting match...");
    navigate(`/play-pvp?matchId=${matchId}`);
  }, [navigate]);
  
  const { incomingChallenges, outgoingChallenges, sendChallenge, acceptChallenge, declineChallenge, cancelChallenge } = useChallenges(handleChallengeAccepted);
  const { decks } = useDecks();
  const [selectedChallengerDeckId, setSelectedChallengerDeckId] = useState<string | null>(null);
  
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

  const handleAcceptChallenge = async (challengeId: string, username: string) => {
    if (!selectedChallengerDeckId) {
      toast.error("Please select a deck to accept the challenge");
      return;
    }
    
    const deck = decks.find(d => d.id === selectedChallengerDeckId);
    if (!deck || deck.card_ids.length !== 7) {
      toast.error("Please select a valid deck with 7 cards");
      return;
    }
    
    const result = await acceptChallenge(challengeId, deck.card_ids);
    if (result.success && result.matchId) {
      toast.success(`Challenge from ${username} accepted! Starting match...`);
      navigate(`/play-pvp?matchId=${result.matchId}`);
    } else {
      toast.error("Failed to accept challenge");
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    const success = await declineChallenge(challengeId);
    if (success) {
      toast.success("Challenge declined");
    } else {
      toast.error("Failed to decline challenge");
    }
  };

  const handleCancelChallenge = async (challengeId: string) => {
    const success = await cancelChallenge(challengeId);
    if (success) {
      toast.success("Challenge cancelled");
    } else {
      toast.error("Failed to cancel challenge");
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
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

      {/* Incoming Challenges Banner */}
      {incomingChallenges.length > 0 && (
        <Card className="w-full max-w-2xl mx-auto mb-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center animate-pulse">
                <Swords className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  You have {incomingChallenges.length} incoming challenge{incomingChallenges.length > 1 ? 's' : ''}!
                </p>
                <p className="text-sm text-muted-foreground">
                  Check the Challenges tab to respond
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="friends" className="w-full max-w-2xl mx-auto">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Friends</span> ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="challenges" className="flex items-center gap-2">
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">Challenges</span>
            {incomingChallenges.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {incomingChallenges.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
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

        {/* Challenges Tab */}
        <TabsContent value="challenges">
          <div className="space-y-4">
            {/* Deck Selection for Accepting Challenges */}
            {validDecks.length > 0 && incomingChallenges.length > 0 && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Select deck to accept challenges:</label>
                  <select
                    value={selectedChallengerDeckId || ""}
                    onChange={(e) => setSelectedChallengerDeckId(e.target.value || null)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Choose a deck...</option>
                    {validDecks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        Deck {deck.slot.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            )}

            {/* Incoming Challenges */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Swords className="h-5 w-5 text-orange-500" />
                  Incoming Challenges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {incomingChallenges.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No incoming challenges.
                  </p>
                ) : (
                  incomingChallenges.map((challenge) => (
                    <div
                      key={challenge.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <Swords className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            {challenge.challenger_username || "Unknown"} challenges you!
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Expires in {getTimeRemaining(challenge.expires_at)}</span>
                            {challenge.is_ranked && (
                              <Badge variant="secondary" className="text-xs">Ranked</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAcceptChallenge(challenge.id, challenge.challenger_username || "challenger")}
                          disabled={!selectedChallengerDeckId}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeclineChallenge(challenge.id)}
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

            {/* Outgoing Challenges */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  Sent Challenges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outgoingChallenges.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No outgoing challenges.
                  </p>
                ) : (
                  outgoingChallenges.map((challenge) => (
                    <div
                      key={challenge.id}
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Send className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground block">
                            Waiting for response...
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Expires in {getTimeRemaining(challenge.expires_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelChallenge(challenge.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Cancel
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
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
