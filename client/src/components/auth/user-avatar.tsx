import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/user-utils";

interface UserAvatarProps {
  name: string;
  picture?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12", 
  lg: "w-20 h-20"
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg"
};

export function UserAvatar({ name, picture, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage src={picture} alt={name} />
      <AvatarFallback className={`bg-gradient-to-br from-blue-500 to-purple-600 text-white ${textSizeClasses[size]} font-medium`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}