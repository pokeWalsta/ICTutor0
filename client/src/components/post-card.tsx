import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, MessageCircle, Check, XCircle, ArrowDown, Trash2 } from "lucide-react";
import type { Post } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Define Vote type more explicitly for the frontend
interface Vote {
  id: number;
  userId: string;
  postId: number | null;
  replyId: number | null;
  voteType: string;
}

// Extended Post type for UI purposes
interface ExtendedPost extends Post {
  replyCount?: number;
}

export default function PostCard({ post }: { post: ExtendedPost }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: author } = useQuery<User>({
    queryKey: [`/api/users/${post.authorId}`],
  });
  
  const { data: userVote } = useQuery<Vote | null>({
    queryKey: [`/api/votes/user/${user?.uid}/post/${post.id}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      try {
        return await apiRequest(`/api/posts/${post.id}/vote?userId=${user.uid}`);
      } catch (error) {
        // If vote not found (404), return null instead of throwing
        return null;
      }
    },
    enabled: !!user?.uid,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ voteType }: { voteType: 'upvote' | 'downvote' }) => {
      if (!user?.uid) {
        throw new Error('You must be logged in to vote');
      }
      return apiRequest(`/api/posts/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          voteType
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/votes/user/${user?.uid}/post/${post.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to vote on post',
        variant: 'destructive',
      });
    },
  });

  const removeSolutionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) {
        throw new Error('You must be logged in to remove a solution');
      }
      return apiRequest(`/api/posts/${post.id}/solution`, {
        method: 'DELETE',
        body: JSON.stringify({
          userId: user.uid,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: 'Success',
        description: 'Solution has been removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove solution',
        variant: 'destructive',
      });
    },
  });
  
  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) {
        throw new Error('You must be logged in to delete a post');
      }
      return apiRequest(`/api/posts/${post.id}?userId=${user.uid}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: 'Success',
        description: 'Post has been deleted',
      });
      // If we're on the thread page, navigate back to home
      if (window.location.pathname === `/thread/${post.id}`) {
        setLocation('/');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete post',
        variant: 'destructive',
      });
    },
  });

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to vote on posts',
        variant: 'destructive',
      });
      return;
    }
    
    // If user already voted with the same type, do nothing
    if (userVote && userVote.voteType === voteType) {
      return;
    }
    
    voteMutation.mutate({ voteType });
  };

  const handleRemoveSolution = () => {
    removeSolutionMutation.mutate();
  };

  // Check if the current user is the post author
  const isPostAuthor = user && post.authorId === user.uid;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Vote buttons column */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={userVote?.voteType === 'upvote' ? 'text-green-500' : ''}
            onClick={() => handleVote('upvote')}
            disabled={voteMutation.isPending}
          >
            <ThumbsUp className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium">
            {(post.upvotes || 0) - (post.downvotes || 0)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={userVote?.voteType === 'downvote' ? 'text-red-500' : ''}
            onClick={() => handleVote('downvote')}
            disabled={voteMutation.isPending}
          >
            <ThumbsDown className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Content column */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Link href={`/thread/${post.id}`}>
              <div className="text-lg font-semibold hover:underline cursor-pointer">
                {post.title}
              </div>
            </Link>
            <Badge variant="outline" className="capitalize">
              {post.category}
            </Badge>
            {post.solutionId && (
              <Badge variant="default" className="bg-green-500">
                Solved
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {author?.username} • {format(new Date(post.createdAt), "PP")}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
          
          {/* Solution section */}
          {post.solutionId && (
            <div className="mt-2 pt-2 border-t flex items-center gap-2">
              <Link href={`/thread/${post.id}#solution-${post.solutionId}`}>
                <div className="text-sm text-green-600 flex items-center gap-1 hover:underline cursor-pointer">
                  <Check className="h-4 w-4" />
                  <span>View solution</span>
                  <ArrowDown className="h-3 w-3" />
                </div>
              </Link>
              
              {isPostAuthor && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={handleRemoveSolution}
                  disabled={removeSolutionMutation.isPending}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Remove solution
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Comments count indicator */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{post.replyCount || 0}</span>
        </div>
      </div>
    </Card>
  );
}