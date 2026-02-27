import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import {
  tasks,
  taskApplications,
  taskAssignments,
  wallets,
  transactions,
  notifications,
  agents,
} from "@/drizzle/schema";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { eq, sql } from "drizzle-orm";
import { validateUUID } from "@/lib/security/validate";
import { sendWebhook } from "@/lib/webhooks";
import { sendAgentWebhook } from "@/lib/agent-webhooks";
import { preventSelfDealing } from "@/lib/security/access-control";
import { logFinancialOperation, logTaskOperation } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

/**
 * POST /api/tasks/[id]/select
 * Buyer selects a winning bid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return unauthorized("Authentication required");
    }

    const body = await request.json();
    const { application_id } = body;

    // Validate UUIDs
    try {
      validateUUID(id, 'task ID');
      validateUUID(application_id, 'application ID');
    } catch (validationError: any) {
      return error(validationError.message);
    }

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Get task with FOR UPDATE lock
      const task = await tx.query.tasks.findFirst({
        where: eq(tasks.id, id),
        with: {
          assignment: true,
        },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      // Check if user is the task buyer
      if (task.buyerId !== session.user.id) {
        throw new Error("Only the task buyer can select an agent");
      }

      // Check if task is already assigned
      if (task.assignment) {
        throw new Error("Task is already assigned");
      }

      // Check if task is in correct status
      if (task.status !== "open" && task.status !== "matching") {
        throw new Error("Task is not available for assignment");
      }

      // Get the application
      const application = await tx.query.taskApplications.findFirst({
        where: eq(taskApplications.id, application_id),
        with: {
          agent: true,
        },
      });

      if (!application) {
        throw new Error("Application not found");
      }

      // Verify application is for this task
      if (application.taskId !== id) {
        throw new Error("Application does not belong to this task");
      }

      // Check if application is still pending
      if (application.status !== "pending") {
        throw new Error("Application is no longer available");
      }

      // SECURITY: Prevent self-dealing
      await preventSelfDealing(task.id, application.agentId, ip);

      // Get buyer's wallet with FOR UPDATE lock
      const buyerWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, task.buyerId),
      });

      if (!buyerWallet) {
        throw new Error("Buyer wallet not found");
      }

      // Check if buyer has sufficient balance
      const agreedPrice = parseFloat(application.bidAmount);
      const currentBalance = parseFloat(buyerWallet.balance);
      
      if (currentBalance < agreedPrice) {
        throw new Error("Insufficient funds. Please top up your wallet.");
      }

      // Lock funds in escrow
      const escrowBefore = parseFloat(buyerWallet.escrowBalance);

      await tx
        .update(wallets)
        .set({
          balance: (currentBalance - agreedPrice).toFixed(2),
          escrowBalance: (escrowBefore + agreedPrice).toFixed(2),
        })
        .where(eq(wallets.id, buyerWallet.id));

      // Record transaction
      await tx.insert(transactions).values({
        walletId: buyerWallet.id,
        type: "escrow_lock",
        amount: agreedPrice.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: (currentBalance - agreedPrice).toFixed(2),
        referenceType: "task",
        referenceId: task.id,
        description: `Escrow lock for task: ${task.title}`,
      });

      // Create assignment
      const [assignment] = await tx
        .insert(taskAssignments)
        .values({
          taskId: task.id,
          agentId: application.agentId,
          agreedPrice: agreedPrice.toFixed(2),
          status: "assigned",
        })
        .returning();

      // Update task status
      await tx
        .update(tasks)
        .set({
          status: "assigned",
          assignedAt: new Date(),
        })
        .where(eq(tasks.id, task.id));

      // Update selected application to accepted
      await tx
        .update(taskApplications)
        .set({
          status: "accepted",
        })
        .where(eq(taskApplications.id, application.id));

      // Reject all other applications for this task
      await tx
        .update(taskApplications)
        .set({
          status: "rejected",
        })
        .where(eq(taskApplications.taskId, task.id));

      // Revert rejection for the accepted one
      await tx
        .update(taskApplications)
        .set({
          status: "accepted",
        })
        .where(eq(taskApplications.id, application.id));

      // Notify the selected agent
      if (application.agent) {
        await tx.insert(notifications).values({
          userId: application.agent.sellerId,
          type: "application_accepted",
          message: `Your application for task "${task.title}" has been accepted! Price: $${agreedPrice}`,
          referenceType: "task",
          referenceId: task.id,
        });
      }

      // Get all rejected applications to notify those agents
      const rejectedApps = await tx.query.taskApplications.findMany({
        where: eq(taskApplications.taskId, task.id),
        with: {
          agent: true,
        },
      });

      for (const app of rejectedApps) {
        if (app.status === "rejected" && app.agent) {
          await tx.insert(notifications).values({
            userId: app.agent.sellerId,
            type: "application_rejected",
            message: `Your application for task "${task.title}" was not selected. The buyer chose another agent.`,
            referenceType: "task",
            referenceId: task.id,
          });
        }
      }

      return {
        task,
        assignment,
        application,
        agreedPrice,
      };
    });

    // Send webhook to assigned agent
    sendAgentWebhook(result.application.agentId, "task.assigned", {
      task_id: result.task.id,
      assignment_id: result.assignment.id,
      agreed_price: result.agreedPrice,
      task_title: result.task.title,
    });

    // Send webhook to buyer
    sendWebhook(session.user.id, "task.assigned", {
      task_id: result.task.id,
      agent_id: result.application.agentId,
      agent_name: result.application.agent.name,
      agreed_price: result.agreedPrice,
    });

    // Audit logs
    logFinancialOperation(
      'escrow.lock',
      session.user.id,
      result.agreedPrice,
      {
        taskId: result.task.id,
        agentId: result.application.agentId,
        assignmentId: result.assignment.id,
      },
      ip
    );

    logTaskOperation(
      'task.assigned',
      session.user.id,
      result.task.id,
      {
        agentId: result.application.agentId,
        agreedPrice: result.agreedPrice,
      },
      ip
    );

    return success(
      {
        task_id: result.task.id,
        assignment_id: result.assignment.id,
        agent_id: result.application.agentId,
        agent_name: result.application.agent.name,
        agreed_price: result.agreedPrice,
        status: "assigned",
        message: "Agent selected successfully. Funds locked in escrow.",
      },
      201
    );
  } catch (err: any) {
    console.error("Error selecting application:", err);
    return serverError(err.message);
  }
}
