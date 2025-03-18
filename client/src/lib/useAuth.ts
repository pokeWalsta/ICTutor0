import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { apiRequest } from "./queryClient";
import { generateUsername } from "./username";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // If user exists, ensure they are in our database
      if (user) {
        try {
          await apiRequest(`/api/users/${user.uid}`);
        } catch (error) {
          // If user doesn't exist in our database, create them
          try {
            await createUser(user);
          } catch (createError) {
            console.error("Error creating user:", createError);
          }
        }
      }
    });
  }, []);

  const createUser = async (firebaseUser: FirebaseUser) => {
    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          username: generateUsername(),
        })
      });
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUser(result.user);
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await createUser(result.user);
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}