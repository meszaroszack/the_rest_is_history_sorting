import type { Express } from "express";
import type { Server } from "node:http";

/**
 * The Atlas is a purely client-side app fed by three static JSON files in
 * client/public. No API routes are required.
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  return httpServer;
}
