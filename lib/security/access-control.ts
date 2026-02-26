/**
 * Access control utilities
 * Helper functions for verifying ownership and permissions
 */

import { db } from "@/drizzle/db";
import { tasks, agents, users, userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logSecurityEvent } from "./audit-log";
import { getClientIp } from "./rate-limit";

/**
 * Check if user owns a task
 */
export async function verifyTaskOwnership(
  taskId: string,
  userId: string,
  ip?: string
): Promise<boolean> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { buyerId: true },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  const isOwner = task.buyerId === userId;

  if (!isOwner) {
    logSecurityEvent(
      'security.validation_failed',
      {
        reason: 'task_ownership_mismatch',
        taskId,
        expectedUserId: task.buyerId,
        actualUserId: userId,
      },
      userId,
      ip
    );
  }

  return isOwner;
}

/**
 * Check if agent belongs to user
 */
export async function verifyAgentOwnership(
  agentId: string,
  userId: string,
  ip?: string
): Promise<boolean> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { sellerId: true },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  const isOwner = agent.sellerId === userId;

  if (!isOwner) {
    logSecurityEvent(
      'security.validation_failed',
      {
        reason: 'agent_ownership_mismatch',
        agentId,
        expectedUserId: agent.sellerId,
        actualUserId: userId,
      },
      userId,
      ip
    );
  }

  return isOwner;
}

/**
 * Check if user has admin role
 */
export async function verifyAdminRole(userId: string, ip?: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    logSecurityEvent(
      'security.validation_failed',
      {
        reason: 'admin_role_required',
        actualRole: user?.role || 'none',
      },
      userId,
      ip
    );
  }

  return isAdmin;
}

/**
 * Prevent self-dealing: Check if task buyer and agent seller are the same person
 */
export async function preventSelfDealing(
  taskId: string,
  agentId: string,
  ip?: string
): Promise<void> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { buyerId: true },
  });

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { sellerId: true },
  });

  if (!task || !agent) {
    throw new Error('Task or agent not found');
  }

  if (task.buyerId === agent.sellerId) {
    logSecurityEvent(
      'security.self_dealing_blocked',
      {
        taskId,
        agentId,
        userId: task.buyerId,
      },
      task.buyerId,
      ip
    );
    throw new Error('Cannot assign task to your own agent (self-dealing blocked)');
  }
}

/**
 * Require task ownership or throw
 */
export async function requireTaskOwnership(
  taskId: string,
  userId: string,
  request?: Request
): Promise<void> {
  const ip = request ? getClientIp(request) : undefined;
  const isOwner = await verifyTaskOwnership(taskId, userId, ip);
  if (!isOwner) {
    throw new Error('Unauthorized: You do not own this task');
  }
}

/**
 * Require agent ownership or throw
 */
export async function requireAgentOwnership(
  agentId: string,
  userId: string,
  request?: Request
): Promise<void> {
  const ip = request ? getClientIp(request) : undefined;
  const isOwner = await verifyAgentOwnership(agentId, userId, ip);
  if (!isOwner) {
    throw new Error('Unauthorized: You do not own this agent');
  }
}

/**
 * Require admin role or throw
 */
export async function requireAdminRole(
  userId: string,
  request?: Request
): Promise<void> {
  const ip = request ? getClientIp(request) : undefined;
  const isAdmin = await verifyAdminRole(userId, ip);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin role required');
  }
}
