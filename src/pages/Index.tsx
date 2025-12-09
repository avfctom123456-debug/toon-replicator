import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/home");
    } else if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-12">
        <img 
          src={gtoonsLogo} 
          alt="gTOONS Remastered" 
          className="w-64 md:w-80 h-auto"
        />
      </div>
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
};

export default Index;