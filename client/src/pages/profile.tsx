import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");

  const { data: profile, isLoading } = useQuery<User>({
    queryKey: [`/api/users/${user?.uid}`],
  });

  const updateUsername = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/users/${user?.uid}/username`, {
        method: "PATCH",
        body: JSON.stringify({ username: newUsername }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.uid}`] });
      toast({ title: "Username updated successfully" });
      setNewUsername("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>

            <div>
              <p className="text-sm font-medium">Current Username</p>
              <p className="text-sm text-muted-foreground">{profile?.username}</p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <Button onClick={() => updateUsername.mutate()}>
                Update Username
              </Button>
            </div>

            <div className="pt-4">
              <Button 
                variant="destructive" 
                onClick={signOut} 
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}