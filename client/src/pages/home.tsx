import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/useAuth";
import PostCard from "@/components/post-card";
import CreatePostDialog from "@/components/create-post-dialog";
import { type Post, type Category, categoryEnum } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: stats } = useQuery<{ totalThreads: number }>({
    queryKey: ["/api/stats"],
  });

  const createPost = useMutation({
    mutationFn: async ({ title, content, category }: { 
      title: string; 
      content: string;
      category: Category;
    }) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          content, 
          category,
          authorId: user!.uid 
        }),
      });
      if (!res.ok) throw new Error("Failed to create post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const filteredPosts = posts?.filter(
    post => selectedCategory === "all" || post.category === selectedCategory
  );

  if (isLoading) {
    return <div>Loading posts...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-7xl mx-auto grid grid-cols-[180px_1fr_160px] gap-4">
        {/* Categories Sidebar */}
        <div className="space-y-4">
          <div className="font-medium text-lg mb-2">Categories</div>
          <div className="space-y-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedCategory("all")}
            >
              All Categories
            </Button>
            {categoryEnum.options.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "ghost"}
                className="w-full justify-start capitalize"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6 p-4"> {/* Added padding here */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {selectedCategory === "all" 
                ? "All Threads" 
                : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Threads`}
            </h1>
            <CreatePostDialog onSubmit={createPost.mutate} />
          </div>

          <div className="space-y-4">
            {filteredPosts?.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Threads</div>
                  <div className="text-2xl font-bold">{stats?.totalThreads || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}