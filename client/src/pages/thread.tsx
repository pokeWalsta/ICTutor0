import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/useAuth";
import PostCard from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Post, Reply, User } from "@shared/schema";

// Define Vote type explicitly for the frontend
interface Vote {
  id: number;
  userId: string;
  postId: number | null;
  replyId: number | null;
  voteType: string;
}

interface ThreadResponse {
  post: Post;
  replies: Reply[];
}

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [replyContent, setReplyContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; username?: string; content?: string } | null>(null);

  // Query to get the post and all replies
  const { data, isLoading } = useQuery<ThreadResponse>({
    queryKey: [`/api/posts/${id}`],
  });
  
  // Query to get detailed post information
  const { data: postDetails } = useQuery<Post>({
    queryKey: [`/api/posts/${id}/details`],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/posts/${id}/details`);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch post details',
          variant: 'destructive',
        });
        return null;
      }
    },
    enabled: !!id,
  });

  const createReply = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.uid) {
        throw new Error('You must be logged in to reply');
      }
      
      let finalContent = content;
      
      // If replying to another reply, automatically include the quote
      if (replyTo) {
        // Get the actual reply from our reply map
        const replyObj = replyMap[replyTo.id];
        
        if (replyObj) {
          // Extract the raw text of the reply, stripping out any previous quotes
          let replyText = replyObj.content;
          
          // If this reply already contains a quote, extract just the reply part
          if (replyText.includes('@') && replyText.includes('>')) {
            const lines = replyText.split('\n');
            const quoteStartIndex = lines.findIndex(line => line.startsWith('>'));
            
            if (quoteStartIndex >= 0) {
              // Find where the quote ends
              let quoteEndIndex = quoteStartIndex;
              while (quoteEndIndex + 1 < lines.length && lines[quoteEndIndex + 1].startsWith('>')) {
                quoteEndIndex++;
              }
              
              // Get the actual reply content (after the quote)
              replyText = lines.slice(quoteEndIndex + 1).join('\n').trim();
            }
          }
          
          // Limit the length of the quoted text
          const quoteText = replyText.length > 100 
            ? replyText.substring(0, 100) + '...' 
            : replyText;
            
          finalContent = `@${replyTo.username || 'Unknown'}:\n> ${quoteText}\n\n${content}`;
        }
      }
      
      return apiRequest(`/api/posts/${id}/replies`, {
        method: "POST",
        body: JSON.stringify({
          content: finalContent,
          authorId: user.uid,
          parentReplyId: replyTo ? replyTo.id : null
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${id}`] });
      setReplyContent("");
      setReplyTo(null);
      
      toast({
        title: 'Success',
        description: 'Your reply has been posted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reply',
        variant: 'destructive',
      });
    },
  });

  // Function to organize replies into threads
  const organizeRepliesIntoThreads = (replies: Reply[]) => {
    // Create a copy of replies to avoid mutating the original
    const sortedReplies = [...replies].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const topLevelReplies: Reply[] = [];
    const childReplies: Record<number, Reply[]> = {};
    
    // Build a map of all replies for quick access
    const replyMap: Record<number, Reply> = {};
    sortedReplies.forEach(reply => {
      replyMap[reply.id] = reply;
    });
    
    // First, organize by parent/child relationships
    sortedReplies.forEach(reply => {
      if (!reply.parentReplyId) {
        // This is a top-level reply (directly to the post)
        topLevelReplies.push(reply);
      } else {
        // This is a child reply (to another reply)
        const parentReply = replyMap[reply.parentReplyId];
        
        // If the parent is a top-level reply OR if we can't find the parent,
        // attach this reply directly to the parent
        if (!parentReply?.parentReplyId) {
          if (!childReplies[reply.parentReplyId]) {
            childReplies[reply.parentReplyId] = [];
          }
          childReplies[reply.parentReplyId].push(reply);
        } else {
          // This is a reply to a nested reply - we'll attach it to the top-level ancestor
          let currentParentId = reply.parentReplyId;
          let topParentId = currentParentId;
          
          // Find the top-level parent by traversing up the chain
          while (currentParentId && replyMap[currentParentId]?.parentReplyId) {
            currentParentId = replyMap[currentParentId].parentReplyId || 0;
            topParentId = currentParentId;
          }
          
          // Add to the top parent's children
          if (topParentId && !childReplies[topParentId]) {
            childReplies[topParentId] = [];
          }
          
          if (topParentId) {
            childReplies[topParentId].push(reply);
          }
        }
      }
    });
    
    // Sort top-level replies chronologically
    topLevelReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Sort child replies of each parent chronologically
    Object.keys(childReplies).forEach(parentId => {
      childReplies[Number(parentId)].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
    
    return { topLevelReplies, childReplies, replyMap };
  };
  
  const handleReplyToReply = (reply: Reply, username?: string) => {
    setReplyTo({ id: reply.id, username, content: reply.content });
  };
  
  const cancelReply = () => {
    setReplyTo(null);
  };

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }
  
  const { topLevelReplies, childReplies, replyMap } = organizeRepliesIntoThreads(data.replies);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PostCard post={data.post} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Replies</h2>

        <div className="space-y-3">
          {topLevelReplies.map((reply) => (
            <div key={reply.id} className="space-y-2">
              <ReplyCard 
                reply={reply} 
                onReply={handleReplyToReply}
              />
              
              {/* Nested replies */}
              <div className="pl-6 ml-6 border-l-2 border-accent space-y-2">
                {childReplies[reply.id] && childReplies[reply.id].map(childReply => (
                  <div key={childReply.id} className="space-y-2">
                    <ReplyCard 
                      reply={childReply} 
                      onReply={handleReplyToReply}
                    />
                    
                    {/* Show reply form directly under this child reply if it's the one being replied to */}
                    {replyTo && replyTo.id === childReply.id && (
                      <Card className="p-4">
                        <div className="bg-accent/50 p-2 rounded mb-2 flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Replying to {replyTo.username || 'comment'}
                          </span>
                          <Button variant="ghost" size="sm" onClick={cancelReply}>
                            Cancel
                          </Button>
                        </div>
                        <Textarea
                          placeholder={`Reply to ${replyTo.username || 'this comment'}...`}
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          className="mb-4 resize-none"
                          rows={4}
                        />
                        <div className="flex justify-end">
                          <Button 
                            onClick={() => createReply.mutate(replyContent)}
                            disabled={!replyContent.trim() || createReply.isPending}
                          >
                            {createReply.isPending ? 'Posting...' : 'Post Reply'}
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Show reply form directly under this top-level reply if it's the one being replied to */}
              {replyTo && replyTo.id === reply.id && (
                <div className="pl-6 ml-6 border-l-2 border-accent">
                  <Card className="p-4">
                    <div className="bg-accent/50 p-2 rounded mb-2 flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Replying to {replyTo.username || 'comment'}
                      </span>
                      <Button variant="ghost" size="sm" onClick={cancelReply}>
                        Cancel
                      </Button>
                    </div>
                    <Textarea
                      placeholder={`Reply to ${replyTo.username || 'this comment'}...`}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="mb-4 resize-none"
                      rows={4}
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={() => createReply.mutate(replyContent)}
                        disabled={!replyContent.trim() || createReply.isPending}
                      >
                        {createReply.isPending ? 'Posting...' : 'Post Reply'}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Show reply form at the bottom if not replying to a specific comment */}
        {!replyTo && (
          <div className="mt-6 mb-12" id="reply-form">
            <h3 className="text-md font-medium mb-2">Add your reply</h3>
            <Card className="p-4">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="mb-4 resize-none"
                rows={4}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={() => createReply.mutate(replyContent)}
                  disabled={!replyContent.trim() || createReply.isPending}
                >
                  {createReply.isPending ? 'Posting...' : 'Post Reply'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyCard({ 
  reply, 
  onReply 
}: { 
  reply: Reply; 
  onReply?: (reply: Reply, username?: string) => void;
}) {
  const { toast } = useToast();
  const localQueryClient = useQueryClient();
  const { user } = useAuth();
  const { id: postId } = useParams<{ id: string }>();
  
  // Query to get the author of the reply
  const { data: author } = useQuery<User>({
    queryKey: [`/api/users/${reply.authorId}`],
  });
  
  // Query to get the post details
  const { data: post } = useQuery<Post>({
    queryKey: [`/api/posts/${postId}/details`],
  });
  
  // Query to get the user's vote on this reply
  const { data: userVote } = useQuery<Vote | null>({
    queryKey: [`/api/votes/user/${user?.uid}/reply/${reply.id}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      try {
        return await apiRequest(`/api/replies/${reply.id}/vote?userId=${user.uid}`);
      } catch (error) {
        // If vote not found (404), return null instead of throwing
        return null;
      }
    },
    enabled: !!user?.uid,
  });

  // Mutation for voting on the reply
  const voteMutation = useMutation({
    mutationFn: async ({ voteType }: { voteType: 'upvote' | 'downvote' }) => {
      if (!user?.uid) {
        throw new Error('You must be logged in to vote');
      }
      return apiRequest(`/api/replies/${reply.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          voteType
        }),
      });
    },
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
      localQueryClient.invalidateQueries({ queryKey: [`/api/votes/user/${user?.uid}/reply/${reply.id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to vote on reply',
        variant: 'destructive',
      });
    },
  });

  // Mutation for marking a reply as solution
  const markAsSolutionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) {
        throw new Error('You must be logged in to mark a solution');
      }
      return apiRequest(`/api/posts/${postId}/replies/${reply.id}/solution`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
        }),
      });
    },
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
      toast({
        title: 'Success',
        description: 'The reply has been marked as the solution',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark as solution',
        variant: 'destructive',
      });
    },
  });

  // Handler for voting
  const handleVote = (voteType: 'upvote' | 'downvote') => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to vote on replies',
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
  
  // Determine if this reply can be marked as a solution
  const canMarkAsSolution = post && user && post.authorId === user.uid && !post.solutionId;
  
  // Determine if this reply is already marked as a solution
  const isSolution = reply.isSolution || (post?.solutionId === reply.id);

  // For solution replies, give them a special anchor ID for navigation
  const cardId = isSolution ? `solution-${reply.id}` : `reply-${reply.id}`;
  
  return (
    <Card 
      id={cardId}
      className={`p-4 ${isSolution ? 'border-green-500 border-2' : ''}`}
    >
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
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium">
            {(reply.upvotes || 0) - (reply.downvotes || 0)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={userVote?.voteType === 'downvote' ? 'text-red-500' : ''}
            onClick={() => handleVote('downvote')}
            disabled={voteMutation.isPending}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content column */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {author?.username || "Loading..."} • {format(new Date(reply.createdAt), "PP")}
            </p>
            {isSolution && (
              <Badge className="bg-green-500">
                <Check className="h-3 w-3 mr-1" /> Solution
              </Badge>
            )}
          </div>
          
          {/* Display content with quote formatting if applicable */}
          {reply.content && reply.content.includes('@') && reply.content.includes('>') ? (
            <div className="space-y-2">
              {/* Extract and display the quote */}
              {(() => {
                const lines = reply.content.split('\n');
                const quoteStartIndex = lines.findIndex(line => line.startsWith('>'));
                
                if (quoteStartIndex >= 0) {
                  // Extract username from the format "@Username:"
                  const usernameLine = lines[quoteStartIndex - 1];
                  const username = usernameLine.startsWith('@') 
                    ? usernameLine.substring(1, usernameLine.indexOf(':'))
                    : null;
                  
                  // Find where the quote ends
                  let quoteEndIndex = quoteStartIndex;
                  while (quoteEndIndex + 1 < lines.length && lines[quoteEndIndex + 1].startsWith('>')) {
                    quoteEndIndex++;
                  }
                  
                  // Extract the actual reply content (after the quote)
                  const replyContent = lines.slice(quoteEndIndex + 1).join('\n').trim();
                  
                  // Extract the quoted text
                  const quotedText = lines
                    .slice(quoteStartIndex, quoteEndIndex + 1)
                    .map(line => line.substring(1).trim())
                    .join('\n');
                  
                  return (
                    <>
                      <div className="bg-accent/30 p-2 rounded mb-2">
                        <p className="text-xs text-muted-foreground">
                          Replying to <span className="font-medium">{username}</span>
                        </p>
                        <p className="text-sm italic">"{quotedText}"</p>
                      </div>
                      <p className="text-sm">{replyContent}</p>
                    </>
                  );
                }
                return <p className="text-sm">{reply.content}</p>;
              })()}
            </div>
          ) : (
            <p className="text-sm">{reply.content}</p>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-2">
            {onReply && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs"
                onClick={() => onReply(reply, author?.username)}
              >
                <MessageCircle className="h-3 w-3 mr-1" /> 
                Reply
              </Button>
            )}
            
            {canMarkAsSolution && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={() => markAsSolutionMutation.mutate()}
                disabled={markAsSolutionMutation.isPending}
              >
                <Check className="h-3 w-3 mr-1" /> 
                Mark as Solution
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}