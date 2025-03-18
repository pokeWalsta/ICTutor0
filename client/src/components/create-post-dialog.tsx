import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PostForm from "./post-form";
import { Plus } from "lucide-react";
import type { Category } from "@shared/schema";

interface CreatePostDialogProps {
  onSubmit: (data: { title: string; content: string; category: Category }) => void;
}

export default function CreatePostDialog({ onSubmit }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = (data: { title: string; content: string; category: Category }) => {
    onSubmit(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Thread</DialogTitle>
        </DialogHeader>
        <PostForm onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
