import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import admin from "firebase-admin";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Firebase Admin with project credentials
async function initializeFirebase() {
  try {
    log("Starting Firebase Admin SDK initialization...");

    // Get Firebase project ID from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId) {
      throw new Error("Neither FIREBASE_PROJECT_ID nor VITE_FIREBASE_PROJECT_ID environment variable is set");
    }
    if (!privateKey) {
      throw new Error("FIREBASE_PRIVATE_KEY environment variable is not set");
    }
    if (!clientEmail) {
      throw new Error("FIREBASE_CLIENT_EMAIL environment variable is not set");
    }

    log(`Initializing Firebase Admin SDK for project: ${projectId}`);
    log(`Using client email: ${clientEmail}`);

    if (!admin.apps.length) {
      // Create the service account credential
      const serviceAccount = {
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      };

      await admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
        databaseURL: `https://${projectId}.firebaseio.com`
      });

      // Test the connection
      try {
        log("Testing Firestore connection...");
        await admin.firestore().collection('test').doc('test').get();
        log("Firebase Admin SDK initialized and connected successfully ✓");
      } catch (error: any) {
        log(`Firebase connection test failed: ${error.message}`);
        throw error;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error initializing Firebase Admin SDK: ${errorMessage}`);
    throw error; // We need Firebase Admin to work for auth
  }
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize Firebase first
    await initializeFirebase();

    // Then register routes and create server
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error handler caught: ${message}`);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server started and listening on port ${port}`);
    });
  } catch (error) {
    log(`Fatal error during startup: ${error}`);
    process.exit(1);
  }
})();