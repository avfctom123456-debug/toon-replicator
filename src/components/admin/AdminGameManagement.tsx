import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gamepad2, RefreshCw, Eye, XCircle, Search, Clock, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  phase: string;
  current_turn: string | null;
  winner_id: string | null;
  win_method: string | null;
  player1_ready: boolean;
  player2_ready: boolean;
  player1_last_seen: string;
  player2_last_seen: string;
  created_at: string;
  updated_at: string;
  game_state: Record<string, unknown>;
  player1_deck: number[];
  player2_deck: number[];
}

interface QueueEntry {
  id: string;
  user_id: string;
  deck_card_ids: number[];
  created_at: string;
}

interface PlayerProfile {
  user_id: string;
  username: string;
}

export function AdminGameManagement() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all matches (recent ones)
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (matchesError) throw matchesError;

      // Fetch matchmaking queue
      const { data: queueData, error: queueError } = await supabase
        .from("matchmaking_queue")
        .select("*")
        .order("created_at", { ascending: true });

      if (queueError) throw queueError;

      // Get all unique user IDs
      const userIds = new Set<string>();
      matchesData?.forEach((m) => {
        userIds.add(m.player1_id);
        userIds.add(m.player2_id);
        if (m.winner_id) userIds.add(m.winner_id);
      });
      queueData?.forEach((q) => userIds.add(q.user_id));

      // Fetch profiles for all users
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", Array.from(userIds));

        const profileMap: Record<string, string> = {};
        profilesData?.forEach((p) => {
          profileMap[p.user_id] = p.username;
        });
        setProfiles(profileMap);
      }

      setMatches((matchesData || []) as Match[]);
      setQueue((queueData || []) as QueueEntry[]);
    } catch (error) {
      console.error("Error fetching game data:", error);
      toast.error("Failed to fetch game data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const matchChannel = supabase
      .channel("admin-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matchmaking_queue" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, []);

  const getUsername = (userId: string) => profiles[userId] || userId.slice(0, 8);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "waiting":
        return "bg-yellow-500/20 text-yellow-500";
      case "round1-place":
      case "round2-place":
        return "bg-blue-500/20 text-blue-500";
      case "round1-reveal":
      case "round2-reveal":
        return "bg-purple-500/20 text-purple-500";
      case "game-over":
        return "bg-green-500/20 text-green-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const activeMatches = matches.filter((m) => m.phase !== "game-over");
  const completedMatches = matches.filter((m) => m.phase === "game-over");

  const filteredActive = activeMatches.filter((m) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      getUsername(m.player1_id).toLowerCase().includes(search) ||
      getUsername(m.player2_id).toLowerCase().includes(search) ||
      m.id.toLowerCase().includes(search)
    );
  });

  const filteredCompleted = completedMatches.filter((m) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      getUsername(m.player1_id).toLowerCase().includes(search) ||
      getUsername(m.player2_id).toLowerCase().includes(search) ||
      m.id.toLowerCase().includes(search)
    );
  });

  const forceEndMatch = async (matchId: string, winnerId: string | null) => {
    try {
      const { error } = await supabase
        .from("matches")
        .update({
          phase: "game-over",
          winner_id: winnerId,
          win_method: "admin_forfeit",
        })
        .eq("id", matchId);

      if (error) throw error;
      toast.success("Match force ended");
      fetchData();
    } catch (error) {
      console.error("Error ending match:", error);
      toast.error("Failed to end match");
    }
  };

  const removeFromQueue = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("matchmaking_queue")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      toast.success("Removed from queue");
      fetchData();
    } catch (error) {
      console.error("Error removing from queue:", error);
      toast.error("Failed to remove from queue");
    }
  };

  const viewMatchDetails = (match: Match) => {
    setSelectedMatch(match);
    setShowMatchDetails(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMatches.length}</p>
                <p className="text-sm text-muted-foreground">Active Games</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queue.length}</p>
                <p className="text-sm text-muted-foreground">In Queue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Gamepad2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedMatches.length}</p>
                <p className="text-sm text-muted-foreground">Completed (last 100)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMatches.length * 2 + queue.length}</p>
                <p className="text-sm text-muted-foreground">Players Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by player or match ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Matchmaking Queue */}
      {queue.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Matchmaking Queue ({queue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Deck Size</TableHead>
                  <TableHead>Waiting Since</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {getUsername(entry.user_id)}
                    </TableCell>
                    <TableCell>{entry.deck_card_ids.length} cards</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeFromQueue(entry.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Active Matches */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Active Matches ({filteredActive.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActive.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active matches</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Players</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Ready Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActive.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{getUsername(match.player1_id)}</p>
                        <p className="text-muted-foreground">vs {getUsername(match.player2_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPhaseColor(match.phase)}>
                        {match.phase}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant={match.player1_ready ? "default" : "outline"}>
                          P1: {match.player1_ready ? "Ready" : "Placing"}
                        </Badge>
                        <Badge variant={match.player2_ready ? "default" : "outline"}>
                          P2: {match.player2_ready ? "Ready" : "Placing"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>P1: {formatDistanceToNow(new Date(match.player1_last_seen), { addSuffix: true })}</p>
                        <p>P2: {formatDistanceToNow(new Date(match.player2_last_seen), { addSuffix: true })}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewMatchDetails(match)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => forceEndMatch(match.id, null)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          End
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Completed Matches */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Recent Completed Matches ({filteredCompleted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCompleted.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No completed matches</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Players</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompleted.slice(0, 20).map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className={match.winner_id === match.player1_id ? "font-bold text-green-500" : ""}>
                          {getUsername(match.player1_id)}
                        </p>
                        <p className={match.winner_id === match.player2_id ? "font-bold text-green-500" : "text-muted-foreground"}>
                          vs {getUsername(match.player2_id)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {match.winner_id ? (
                        <Badge className="bg-green-500/20 text-green-500">
                          {getUsername(match.winner_id)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Draw</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {match.win_method || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(match.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewMatchDetails(match)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match Details Dialog */}
      <Dialog open={showMatchDetails} onOpenChange={setShowMatchDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Match Details</DialogTitle>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Match ID</p>
                  <p className="font-mono text-xs break-all">{selectedMatch.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phase</p>
                  <Badge className={getPhaseColor(selectedMatch.phase)}>
                    {selectedMatch.phase}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="font-bold mb-2">Player 1</p>
                    <p>{getUsername(selectedMatch.player1_id)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ready: {selectedMatch.player1_ready ? "Yes" : "No"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last seen: {formatDistanceToNow(new Date(selectedMatch.player1_last_seen), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Deck: {selectedMatch.player1_deck.length} cards
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="font-bold mb-2">Player 2</p>
                    <p>{getUsername(selectedMatch.player2_id)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ready: {selectedMatch.player2_ready ? "Yes" : "No"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last seen: {formatDistanceToNow(new Date(selectedMatch.player2_last_seen), { addSuffix: true })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Deck: {selectedMatch.player2_deck.length} cards
                    </p>
                  </CardContent>
                </Card>
              </div>

              {selectedMatch.winner_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Winner</p>
                  <Badge className="bg-green-500/20 text-green-500">
                    {getUsername(selectedMatch.winner_id)} ({selectedMatch.win_method})
                  </Badge>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Game State (JSON)</p>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(selectedMatch.game_state, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{new Date(selectedMatch.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{new Date(selectedMatch.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedMatch.phase !== "game-over" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => forceEndMatch(selectedMatch.id, selectedMatch.player1_id)}
                  >
                    P1 Wins
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => forceEndMatch(selectedMatch.id, selectedMatch.player2_id)}
                  >
                    P2 Wins
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => forceEndMatch(selectedMatch.id, null)}
                  >
                    End as Draw
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
