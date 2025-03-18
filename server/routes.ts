import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, insertReplySchema, insertVoteSchema } from "@shared/schema";
import { z } from "zod";
import admin from "firebase-admin";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  });

  app.patch("/api/users/:id/username", async (req, res) => {
    const schema = z.object({ username: z.string().min(3).max(30) });
    try {
      const { username } = schema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }
      const user = await storage.updateUsername(req.params.id, username);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid username" });
    }
  });

  app.get("/api/posts", async (_req, res) => {
    try {
      const posts = await storage.getPosts();
      
      // Get reply counts for posts
      const postsWithReplyCount = await Promise.all(posts.map(async (post) => {
        const replies = await storage.getReplies(post.id);
        return {
          ...post,
          replyCount: replies.length
        };
      }));
      
      res.json(postsWithReplyCount);
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ 
        message: "Error fetching posts",
        details: error.message 
      });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(Number(req.params.id));
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }
      const replies = await storage.getReplies(post.id);
      res.json({ post, replies });
    } catch (error: any) {
      console.error('Error fetching post and replies:', error);
      res.status(500).json({ 
        message: "Error fetching post data",
        details: error.message 
      });
    }
  });
  
  // Route to get just the post details without replies
  app.get("/api/posts/:id/details", async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const post = await storage.getPost(postId);
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }

      res.json(post);
    } catch (error: any) {
      console.error('Error getting post details:', error);
      res.status(500).json({ 
        message: "Failed to get post details",
        details: error.message
      });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const data = insertPostSchema.parse(req.body);
      const post = await storage.createPost({
        ...data,
        authorId: req.body.authorId,
      });
      res.json(post);
    } catch (error) {
      res.status(400).json({ message: "Invalid post data" });
    }
  });

  app.post("/api/posts/:id/replies", async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const post = await storage.getPost(postId);
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }

      const data = insertReplySchema.parse({ ...req.body, postId });
      const reply = await storage.createReply({
        ...data,
        authorId: req.body.authorId,
      });
      res.json(reply);
    } catch (error) {
      res.status(400).json({ message: "Invalid reply data" });
    }
  });

  // New route for voting on posts
  app.post("/api/posts/:id/vote", async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const post = await storage.getPost(postId);
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }

      const schema = z.object({ 
        userId: z.string(),
        voteType: z.enum(["upvote", "downvote"])
      });
      
      const { userId, voteType } = schema.parse(req.body);
      
      const vote = await storage.createVote({
        userId,
        postId,
        voteType
      });
      
      res.json(vote);
    } catch (error) {
      console.error('Error voting on post:', error);
      res.status(400).json({ message: "Invalid vote data" });
    }
  });
  
  // GET route to retrieve a user's vote on a post
  app.get("/api/posts/:id/vote", async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const userId = req.query.userId as string;
      
      if (!userId) {
        res.status(400).json({ message: "userId query parameter is required" });
        return;
      }
      
      const vote = await storage.getVote(userId, postId, null);
      if (!vote) {
        res.status(404).json({ message: "Vote not found" });
        return;
      }
      
      res.json(vote);
    } catch (error: any) {
      console.error('Error retrieving vote:', error);
      res.status(500).json({ 
        message: "Failed to retrieve vote",
        details: error.message
      });
    }
  });

  // New route for voting on replies
  app.post("/api/replies/:id/vote", async (req, res) => {
    try {
      const replyId = Number(req.params.id);
      const reply = await storage.getReply(replyId);
      if (!reply) {
        res.status(404).json({ message: "Reply not found" });
        return;
      }

      const schema = z.object({ 
        userId: z.string(),
        voteType: z.enum(["upvote", "downvote"])
      });
      
      const { userId, voteType } = schema.parse(req.body);
      
      const vote = await storage.createVote({
        userId,
        replyId,
        voteType
      });
      
      res.json(vote);
    } catch (error) {
      console.error('Error voting on reply:', error);
      res.status(400).json({ message: "Invalid vote data" });
    }
  });
  
  // GET route to retrieve a user's vote on a reply
  app.get("/api/replies/:id/vote", async (req, res) => {
    try {
      const replyId = Number(req.params.id);
      const userId = req.query.userId as string;
      
      if (!userId) {
        res.status(400).json({ message: "userId query parameter is required" });
        return;
      }
      
      const vote = await storage.getVote(userId, null, replyId);
      if (!vote) {
        res.status(404).json({ message: "Vote not found" });
        return;
      }
      
      res.json(vote);
    } catch (error: any) {
      console.error('Error retrieving vote:', error);
      res.status(500).json({ 
        message: "Failed to retrieve vote",
        details: error.message
      });
    }
  });

  // New route for marking a reply as solution
  app.post("/api/posts/:postId/replies/:replyId/solution", async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      const replyId = Number(req.params.replyId);
      
      // Verify that the user is the post author
      const post = await storage.getPost(postId);
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }
      
      if (post.authorId !== req.body.userId) {
        res.status(403).json({ message: "Only the post author can mark a solution" });
        return;
      }
      
      await storage.markAsSolution(postId, replyId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking solution:', error);
      res.status(400).json({ message: "Failed to mark solution" });
    }
  });
  
  // Route for removing a solution from a post
  app.delete("/api/posts/:postId/solution", async (req, res) => {
    try {
      const postId = Number(req.params.postId);
      
      // Verify that the user is the post author
      const post = await storage.getPost(postId);
      if (!post) {
        res.status(404).json({ message: "Post not found" });
        return;
      }
      
      if (post.authorId !== req.body.userId) {
        res.status(403).json({ message: "Only the post author can remove a solution" });
        return;
      }
      
      await storage.removeSolution(postId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing solution:', error);
      res.status(400).json({ message: "Failed to remove solution" });
    }
  });

  // New stats endpoint
  app.get("/api/stats", async (_req, res) => {
    try {
      let totalUsers = 0;
      try {
        // Get total users from Firebase
        const { users } = await admin.auth().listUsers();
        totalUsers = users.length;
      } catch (error) {
        console.error('Error fetching Firebase users:', error);
        // Continue with totalUsers as 0 if Firebase fails
      }

      // Get total threads from our storage
      const posts = await storage.getPosts();
      const totalThreads = posts.length;

      res.json({
        totalUsers,
        totalThreads
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Delete post endpoint
  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        res.status(400).json({ message: "Invalid post ID" });
        return;
      }

      // Get user ID from query parameter
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(401).json({ message: "User ID is required" });
        return;
      }

      // Attempt to delete the post
      const result = await storage.deletePost(postId, userId);
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      if (error.message && error.message.includes('Unauthorized')) {
        res.status(403).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || "Failed to delete post" });
      }
    }
  });

  // Delete reply endpoint
  app.delete("/api/replies/:id", async (req, res) => {
    try {
      const replyId = parseInt(req.params.id);
      if (isNaN(replyId)) {
        res.status(400).json({ message: "Invalid reply ID" });
        return;
      }

      // Get user ID from query parameter
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(401).json({ message: "User ID is required" });
        return;
      }

      // Attempt to delete the reply
      const result = await storage.deleteReply(replyId, userId);
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error deleting reply:', error);
      if (error.message && error.message.includes('Unauthorized')) {
        res.status(403).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message || "Failed to delete reply" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}