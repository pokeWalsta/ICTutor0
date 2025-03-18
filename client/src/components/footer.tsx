import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-card border-t mt-auto py-6">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <img 
            src="https://cdn.discordapp.com/attachments/701395498418044958/1334517086940172328/20250130_213222.png?ex=67d77c23&is=67d62aa3&hm=0a652e2b63d9f0c76538644a04c952f3d53c247cf4cbf62ceea65041a652a3c7&" 
            alt="ICTutor Logo" 
            className="h-8 w-8 mr-2"
          />
          <span className="text-lg font-semibold">ICTutor</span>
        </div>
        
        <div className="flex flex-wrap justify-center">
          <span className="text-sm text-muted-foreground">A platform for learning and discussing Information & Communication Technology</span>
        </div>
        
        <div className="mt-4 md:mt-0 text-sm text-muted-foreground">
          © {new Date().getFullYear()} ICTutor. All rights reserved.
        </div>
      </div>
    </footer>
  );
}