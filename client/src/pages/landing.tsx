import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex-1 flex items-center">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-8">
          <img 
            src="https://cdn.discordapp.com/attachments/701395498418044958/1334517086940172328/20250130_213222.png?ex=67d77c23&is=67d62aa3&hm=0a652e2b63d9f0c76538644a04c952f3d53c247cf4cbf62ceea65041a652a3c7&" 
            alt="ICTutor Logo" 
            className="h-40 w-40 md:h-48 md:w-48"
          />
          <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Welcome to ICTutor
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Your platform for learning and discussing Information & Communication Technology. Join our community of students and professionals.
          </p>
          <div className="flex gap-4">
            <Link href="/forum">
              <Button size="lg" className="text-lg px-8 cursor-pointer">
                Visit Forum
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 cursor-pointer">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}