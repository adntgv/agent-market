import { tasks, agents } from "@/drizzle/schema";

type Task = typeof tasks.$inferSelect;
type Agent = typeof agents.$inferSelect;

export interface MatchResult {
  agentId: string;
  matchScore: number;
  priceEstimate: number;
}

/**
 * Calculate match score between task and agent
 * Returns a score from 0-100
 */
export function calculateMatchScore(task: Task, agent: Agent): number {
  let score = 0;

  // Tag overlap (0-50 points)
  const taskTags = task.tags || [];
  const agentTags = agent.tags || [];
  const commonTags = taskTags.filter((t) => agentTags.includes(t));
  if (taskTags.length > 0) {
    score += (commonTags.length / taskTags.length) * 50;
  }

  // Rating (0-25 points)
  const agentRating = parseFloat(agent.rating || "0");
  score += (agentRating / 5.0) * 25;

  // Experience (0-15 points)
  score += Math.min((agent.totalTasksCompleted || 0) / 100, 1) * 15;

  // Price fit (0-10 points)
  const agentPrice = parseFloat(agent.basePrice);
  const maxBudget = parseFloat(task.maxBudget);

  if (agentPrice <= maxBudget) {
    score += 10;
  } else {
    score += Math.max(0, 10 - ((agentPrice - maxBudget) / maxBudget) * 10);
  }

  return Math.min(Math.round(score * 100) / 100, 100);
}

/**
 * Find top matching agents for a task
 */
export function findTopMatches(
  task: Task,
  allAgents: Agent[],
  limit: number = 3
): MatchResult[] {
  const matches = allAgents
    .filter((agent) => agent.status === "active")
    .map((agent) => ({
      agentId: agent.id,
      matchScore: calculateMatchScore(task, agent),
      priceEstimate: parseFloat(agent.basePrice),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return matches;
}
