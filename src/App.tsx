import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import DeckBuilder from "./pages/DeckBuilder";
import DeckEdit from "./pages/DeckEdit";
import Lobby from "./pages/Lobby";
import PlayComputer from "./pages/PlayComputer";
import PlayPVP from "./pages/PlayPVP";
import PackShop from "./pages/PackShop";
import TradeBoard from "./pages/TradeBoard";
import AuctionView from "./pages/AuctionView";
import AdminPanel from "./pages/AdminPanel";
import CardCollection from "./pages/CardCollection";
import CardEditor from "./pages/CardEditor";
import CardCreator from "./pages/CardCreator";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/home" element={<Home />} />
            <Route path="/deck-builder" element={<DeckBuilder />} />
            <Route path="/deck-edit" element={<DeckEdit />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/play" element={<PlayComputer />} />
            <Route path="/play-pvp" element={<PlayPVP />} />
            <Route path="/pack-shop" element={<PackShop />} />
            <Route path="/trade-board" element={<TradeBoard />} />
            <Route path="/auction/:id" element={<AuctionView />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/card-editor" element={<CardEditor />} />
            <Route path="/card-creator" element={<CardCreator />} />
            <Route path="/collection" element={<CardCollection />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
