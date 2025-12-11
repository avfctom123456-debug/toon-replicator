import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ClickableUsernameProps {
  userId: string;
  username: string;
  className?: string;
  showYouLabel?: boolean;
  isCurrentUser?: boolean;
}

export const ClickableUsername = ({
  userId,
  username,
  className,
  showYouLabel = false,
  isCurrentUser = false,
}: ClickableUsernameProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer hover:underline hover:text-primary transition-colors",
        isCurrentUser && "text-primary",
        className
      )}
    >
      {username}
      {showYouLabel && isCurrentUser && (
        <span className="text-xs text-primary ml-1">(You)</span>
      )}
    </span>
  );
};
