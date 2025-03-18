import { User, InsertUser, Post, InsertPost, Reply, InsertReply, Vote, InsertVote } from "@shared/schema";
import { getFirestore } from "firebase-admin/firestore";

// Instead of getting db at module level, we'll get it lazily in each method
function getDb() {
  const db = getFirestore();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return db;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUsername(userId: string, username: string): Promise<User>;
  createPost(post: InsertPost & { authorId: string }): Promise<Post>;
  getPosts(): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  deletePost(id: number, authorId: string): Promise<boolean>;
  createReply(reply: InsertReply & { authorId: string }): Promise<Reply>;
  getReplies(postId: number): Promise<Reply[]>;
  getReply(id: number): Promise<Reply | undefined>;
  deleteReply(id: number, authorId: string): Promise<boolean>;
  createVote(vote: InsertVote): Promise<Vote>;
  getVote(userId: string, postId?: number | null, replyId?: number | null): Promise<Vote | undefined>;
  updateVote(voteId: number, voteType: string): Promise<Vote>;
  markAsSolution(postId: number, replyId: number): Promise<void>;
  removeSolution(postId: number): Promise<void>;
}

export class FirestoreStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const doc = await getDb().collection('users').doc(id).get();
      return doc.exists ? doc.data() as User : undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const snapshot = await getDb().collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();

      return snapshot.empty ? undefined : snapshot.docs[0].data() as User;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      await getDb().collection('users').doc(user.id).set(user);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    try {
      const userRef = getDb().collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const user = userDoc.data() as User;
      const updatedUser = { ...user, username };
      await userRef.update({ username });
      return updatedUser;
    } catch (error) {
      console.error('Error updating username:', error);
      throw error;
    }
  }

  async createPost(post: InsertPost & { authorId: string }): Promise<Post> {
    try {
      const postsRef = getDb().collection('posts');
      const snapshot = await postsRef.orderBy('id', 'desc').limit(1).get();

      const lastPost = snapshot.empty ? { id: 0 } : snapshot.docs[0].data();
      const id = (lastPost.id || 0) + 1;

      const newPost: Post = {
        id,
        ...post,
        upvotes: 0,
        downvotes: 0,
        solutionId: null,
        createdAt: new Date(),
      };

      await postsRef.doc(id.toString()).set(newPost);
      return newPost;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async getPosts(): Promise<Post[]> {
    try {
      const snapshot = await getDb().collection('posts')
        .orderBy('createdAt', 'desc')
        .get();

      const posts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt.toDate(),
        } as Post;
      });
      
      // Get reply counts for each post
      const postsWithReplyCounts = await Promise.all(posts.map(async (post) => {
        const repliesSnapshot = await getDb().collection('replies')
          .where('postId', '==', post.id)
          .get();
        
        return {
          ...post,
          replyCount: repliesSnapshot.size || 0
        };
      }));
      
      return postsWithReplyCounts;
    } catch (error) {
      console.error('Error getting posts:', error);
      throw error;
    }
  }

  async getPost(id: number): Promise<Post | undefined> {
    try {
      const doc = await getDb().collection('posts').doc(id.toString()).get();
      if (!doc.exists) return undefined;

      const data = doc.data()!;
      const post = {
        ...data,
        createdAt: data.createdAt.toDate(),
      } as Post;
      
      // Get reply count for the post
      const repliesSnapshot = await getDb().collection('replies')
        .where('postId', '==', post.id)
        .get();
      
      return {
        ...post,
        replyCount: repliesSnapshot.size || 0
      };
    } catch (error) {
      console.error('Error getting post:', error);
      throw error;
    }
  }

  async deletePost(id: number, authorId: string): Promise<boolean> {
    try {
      // Get the post to verify ownership
      const post = await this.getPost(id);
      if (!post) {
        throw new Error('Post not found');
      }

      // Verify the user is the author of the post
      if (post.authorId !== authorId) {
        throw new Error('Unauthorized: You can only delete your own posts');
      }

      // Get all replies to this post to delete them
      const repliesSnapshot = await getDb().collection('replies')
        .where('postId', '==', id)
        .get();

      // Get all votes on this post to delete them
      const votesSnapshot = await getDb().collection('votes')
        .where('postId', '==', id)
        .get();

      // Use a batch to delete everything in one atomic operation
      const batch = getDb().batch();

      // Delete all replies
      repliesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all votes on the post
      votesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete the post itself
      batch.delete(getDb().collection('posts').doc(id.toString()));

      // Commit the batch
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  async createReply(reply: InsertReply & { authorId: string }): Promise<Reply> {
    try {
      if (!reply.postId) {
        throw new Error("postId is required for creating a reply");
      }

      const repliesRef = getDb().collection('replies');
      const snapshot = await repliesRef.orderBy('id', 'desc').limit(1).get();

      const lastReply = snapshot.empty ? { id: 0 } : snapshot.docs[0].data();
      const id = (lastReply.id || 0) + 1;

      const newReply: Reply = {
        id,
        content: reply.content,
        authorId: reply.authorId,
        postId: reply.postId,
        parentReplyId: reply.parentReplyId || null,
        upvotes: 0,
        downvotes: 0,
        isSolution: false,
        createdAt: new Date(),
      };

      await repliesRef.doc(id.toString()).set(newReply);
      return newReply;
    } catch (error) {
      console.error('Error creating reply:', error);
      throw error;
    }
  }

  async getReplies(postId: number): Promise<Reply[]> {
    try {
      const snapshot = await getDb().collection('replies')
        .where('postId', '==', postId)
        .orderBy('createdAt', 'asc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt.toDate(),
        } as Reply;
      });
    } catch (error: any) {
      // Check if the error is due to missing index
      if (error.code === 9 && error.message.includes('index')) {
        console.warn('Firestore index not yet created for replies query. Using unordered results. Please create the index at:', error.details);
        // Fallback to unordered query without the composite index
        const snapshot = await getDb().collection('replies')
          .where('postId', '==', postId)
          .get();

        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt.toDate(),
          } as Reply;
        });
      }
      console.error('Error getting replies:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async getReply(id: number): Promise<Reply | undefined> {
    try {
      const doc = await getDb().collection('replies').doc(id.toString()).get();
      if (!doc.exists) return undefined;

      const data = doc.data()!;
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
      } as Reply;
    } catch (error) {
      console.error('Error getting reply:', error);
      throw error;
    }
  }
  
  async deleteReply(id: number, authorId: string): Promise<boolean> {
    try {
      // Get the reply to verify ownership
      const reply = await this.getReply(id);
      if (!reply) {
        throw new Error('Reply not found');
      }

      // Verify the user is the author of the reply
      if (reply.authorId !== authorId) {
        throw new Error('Unauthorized: You can only delete your own replies');
      }

      // Get the post to check if this reply is marked as a solution
      if (reply.postId) {
        const post = await this.getPost(reply.postId);
        if (post && post.solutionId === id) {
          // If this reply is the solution, remove the solution flag from post
          await getDb()
            .collection('posts')
            .doc(reply.postId.toString())
            .update({ solutionId: null });
        }
      }

      // Get all votes on this reply to delete them
      const votesSnapshot = await getDb().collection('votes')
        .where('replyId', '==', id)
        .get();

      // Use a batch to delete everything in one atomic operation
      const batch = getDb().batch();

      // Delete all votes on the reply
      votesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete the reply itself
      batch.delete(getDb().collection('replies').doc(id.toString()));

      // Commit the batch
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error deleting reply:', error);
      throw error;
    }
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    try {
      // Check if vote already exists
      const existingVote = await this.getVote(vote.userId, vote.postId, vote.replyId);
      if (existingVote) {
        // If vote exists but type is different, update it
        if (existingVote.voteType !== vote.voteType) {
          return this.updateVote(existingVote.id, vote.voteType);
        }
        return existingVote;
      }

      const votesRef = getDb().collection('votes');
      const snapshot = await votesRef.orderBy('id', 'desc').limit(1).get();

      const lastVote = snapshot.empty ? { id: 0 } : snapshot.docs[0].data();
      const id = (lastVote.id || 0) + 1;

      const newVote: Vote = {
        id,
        userId: vote.userId,
        postId: vote.postId || null,
        replyId: vote.replyId || null,
        voteType: vote.voteType,
      };

      await votesRef.doc(id.toString()).set(newVote);

      // Update count on post or reply
      if (vote.postId) {
        const post = await this.getPost(vote.postId);
        if (post) {
          const postRef = getDb().collection('posts').doc(vote.postId.toString());
          if (vote.voteType === 'upvote') {
            await postRef.update({ upvotes: (post.upvotes || 0) + 1 });
          } else {
            await postRef.update({ downvotes: (post.downvotes || 0) + 1 });
          }
        }
      } else if (vote.replyId) {
        const reply = await this.getReply(vote.replyId);
        if (reply) {
          const replyRef = getDb().collection('replies').doc(vote.replyId.toString());
          if (vote.voteType === 'upvote') {
            await replyRef.update({ upvotes: (reply.upvotes || 0) + 1 });
          } else {
            await replyRef.update({ downvotes: (reply.downvotes || 0) + 1 });
          }
        }
      }

      return newVote;
    } catch (error) {
      console.error('Error creating vote:', error);
      throw error;
    }
  }

  async getVote(userId: string, postId?: number | null, replyId?: number | null): Promise<Vote | undefined> {
    try {
      let query = getDb().collection('votes').where('userId', '==', userId);
      
      if (postId) {
        query = query.where('postId', '==', postId);
      } else if (replyId) {
        query = query.where('replyId', '==', replyId);
      } else {
        throw new Error('Either postId or replyId must be provided');
      }

      const snapshot = await query.limit(1).get();
      return snapshot.empty ? undefined : snapshot.docs[0].data() as Vote;
    } catch (error: any) {
      console.error('Error getting vote:', error);
      throw error;
    }
  }

  async updateVote(voteId: number, voteType: string): Promise<Vote> {
    try {
      const voteRef = getDb().collection('votes').doc(voteId.toString());
      const voteDoc = await voteRef.get();

      if (!voteDoc.exists) {
        throw new Error("Vote not found");
      }

      const vote = voteDoc.data() as Vote;
      
      // If vote type is changing, update counts
      if (vote.voteType !== voteType) {
        // Decrement old vote type count
        if (vote.postId) {
          const post = await this.getPost(vote.postId);
          if (post) {
            const postRef = getDb().collection('posts').doc(vote.postId.toString());
            if (vote.voteType === 'upvote') {
              await postRef.update({ upvotes: Math.max(0, (post.upvotes || 0) - 1) });
            } else {
              await postRef.update({ downvotes: Math.max(0, (post.downvotes || 0) - 1) });
            }
            
            // Increment new vote type count
            if (voteType === 'upvote') {
              await postRef.update({ upvotes: (post.upvotes || 0) + 1 });
            } else {
              await postRef.update({ downvotes: (post.downvotes || 0) + 1 });
            }
          }
        } else if (vote.replyId) {
          const reply = await this.getReply(vote.replyId);
          if (reply) {
            const replyRef = getDb().collection('replies').doc(vote.replyId.toString());
            if (vote.voteType === 'upvote') {
              await replyRef.update({ upvotes: Math.max(0, (reply.upvotes || 0) - 1) });
            } else {
              await replyRef.update({ downvotes: Math.max(0, (reply.downvotes || 0) - 1) });
            }
            
            // Increment new vote type count
            if (voteType === 'upvote') {
              await replyRef.update({ upvotes: (reply.upvotes || 0) + 1 });
            } else {
              await replyRef.update({ downvotes: (reply.downvotes || 0) + 1 });
            }
          }
        }
      }

      const updatedVote = { ...vote, voteType };
      await voteRef.update({ voteType });
      return updatedVote;
    } catch (error) {
      console.error('Error updating vote:', error);
      throw error;
    }
  }

  async markAsSolution(postId: number, replyId: number): Promise<void> {
    try {
      // First, get the post and verify it exists
      const post = await this.getPost(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Check if the reply exists and belongs to this post
      const reply = await this.getReply(replyId);
      if (!reply || reply.postId !== postId) {
        throw new Error('Reply not found or does not belong to this post');
      }

      // If another reply was previously marked as solution, unmark it
      if (post.solutionId) {
        const oldSolutionReply = await this.getReply(post.solutionId);
        if (oldSolutionReply) {
          await getDb()
            .collection('replies')
            .doc(oldSolutionReply.id.toString())
            .update({ isSolution: false });
        }
      }

      // Mark the new reply as solution
      await getDb()
        .collection('replies')
        .doc(replyId.toString())
        .update({ isSolution: true });

      // Update the post with the solution reply ID
      await getDb()
        .collection('posts')
        .doc(postId.toString())
        .update({ solutionId: replyId });
    } catch (error) {
      console.error('Error marking reply as solution:', error);
      throw error;
    }
  }

  async removeSolution(postId: number): Promise<void> {
    try {
      // First, get the post and verify it exists
      const post = await this.getPost(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // If there is a solution marked, unmark it
      if (post.solutionId) {
        const solutionReply = await this.getReply(post.solutionId);
        if (solutionReply) {
          await getDb()
            .collection('replies')
            .doc(solutionReply.id.toString())
            .update({ isSolution: false });
        }

        // Remove solution ID from the post
        await getDb()
          .collection('posts')
          .doc(postId.toString())
          .update({ solutionId: null });
      }
    } catch (error) {
      console.error('Error removing solution:', error);
      throw error;
    }
  }
}

export const storage = new FirestoreStorage();