import { Link } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4 h-14 flex items-center">
        <div className="flex-1">
          <Link href="/">
            <div className="text-lg font-semibold flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
              <img 
                src="https://cdn.discordapp.com/attachments/701395498418044958/1334517086940172328/20250130_213222.png?ex=67d77c23&is=67d62aa3&hm=0a652e2b63d9f0c76538644a04c952f3d53c247cf4cbf62ceea65041a652a3c7&" 
                alt="ICTutor Logo" 
                className="h-8 w-8 object-contain"
              />
              ICTutor
            </div>
          </Link>
        </div>

        <div className="flex-1 flex justify-center gap-2">
          <Link href="/forum">
            <Button variant="ghost" className="cursor-pointer">Forum</Button>
          </Link>
          
          <Link href="/about">
            <Button variant="ghost" className="cursor-pointer">About Us</Button>
          </Link>
          
          {user && (
            <Link href="/profile">
              <Button variant="ghost" className="cursor-pointer">Profile</Button>
            </Link>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end">
          {!user && (
            <Link href="/login">
              <Button className="cursor-pointer">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}