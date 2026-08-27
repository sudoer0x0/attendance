import { Redis } from "@upstash/redis";

// Upstash's REST-based client — works from serverless/edge runtimes without
// a persistent TCP connection, which is why it was chosen over ioredis for
// this project (see HANDOFF.md "Tech stack decisions").
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
