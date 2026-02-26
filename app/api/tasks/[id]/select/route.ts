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
import { eq } from "drizzle-orm";

/**
 * POST /api/tasks/[id]/select
 * Buyer selects a winning bid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return unauthorized("Authentication required");
    }

    const body = await request.json();
    const { application_id } = body;

    if (!application_id) {
      return error("Application ID is required");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignment: true,
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Check if user is the task buyer
    if (task.buyerId !== session.user.id) {
      return unauthorized("Only the task buyer can select an agent");
    }

    // Check if task is already assigned
    if (task.assignment) {
      return error("Task is already assigned", 409);
    }

    // Check if task is in correct status
    if (task.status !== "open" && task.status !== "matching") {
      return error("Task is not available for assignment", 409);
    }

    // Get the application
    const application = await db.query.taskApplications.findFirst({
      where: eq(taskApplications.id, application_id),
      with: {
        agent: true,
      },
    });

    if (!application) {
      return notFound("Application not found");
    }

    // Verify application is for this task
    if (application.taskId !== id) {
      return error("Application does not belong to this task");
    }

    // Check if application is still pending
    if (application.status !== "pending") {
      return error("Application is no longer available", 409);
    }

    // Get buyer's wallet
    const buyerWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, task.buyerId),
    });

    if (!buyerWallet) {
      return error("Buyer wallet not found", 500);
    }

    // Check if buyer has sufficient balance
    const agreedPrice = parseFloat(application.bidAmount);
    if (parseFloat(buyerWallet.balance) < agreedPrice) {
      return error("Insufficient funds. Please top up your wallet.", 402);
    }

    // Lock funds in escrow
    const balanceBefore = parseFloat(buyerWallet.balance);
    const escrowBefore = parseFloat(buyerWallet.escrowBalance);

    await db
      .update(wallets)
      .set({
        balance: (balanceBefore - agreedPrice).toFixed(2),
        escrowBalance: (escrowBefore + agreedPrice).toFixed(2),
      })
      .where(eq(wallets.id, buyerWallet.id));

    // Record transaction
    await db.insert(transactions).values({
      walletId: buyerWallet.id,
      type: "escrow_lock",
      amount: agreedPrice.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: (balanceBefore - agreedPrice).toFixed(2),
      referenceType: "task",
      referenceId: task.id,
      description: `Escrow lock for task: ${task.title}`,
    });

    // Create assignment
    const [assignment] = await db
      .insert(taskAssignments)
      .values({
        taskId: task.id,
        agentId: application.agentId,
        agreedPrice: agreedPrice.toFixed(2),
        status: "assigned",
      })
      .returning();

    // Update task status
    await db
      .update(tasks)
      .set({
        status: "assigned",
        assignedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));

    // Update selected application to accepted
    await db
      .update(taskApplications)
      .set({
        status: "accepted",
      })
      .where(eq(taskApplications.id, application.id));

    // Reject all other applications for this task
    await db
      .update(taskApplications)
      .set({
        status: "rejected",
      })
      .where(eq(taskApplications.taskId, task.id));

    // Revert rejection for the accepted one
    await db
      .update(taskApplications)
      .set({
        status: "accepted",
      })
      .where(eq(taskApplications.id, application.id));

    // Get agent's seller user for notification
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, application.agentId),
    });

    if (agent) {
      // Notify the selected agent
      await db.insert(notifications).values({
        userId: agent.sellerId,
        type: "application_accepted",
        message: `Your application for task "${task.title}" has been accepted! Price: $${agreedPrice}`,
        referenceType: "task",
        referenceId: task.id,
      });
    }

    // Get all rejected applications to notify those agents
    const rejectedApps = await db.query.taskApplications.findMany({
      where: eq(taskApplications.taskId, task.id),
      with: {
        agent: true,
      },
    });

    for (const app of rejectedApps) {
      if (app.status === "rejected" && app.agent) {
        await db.insert(notifications).values({
          userId: app.agent.sellerId,
          type: "application_rejected",
          message: `Your application for task "${task.title}" was not selected. The buyer chose another agent.`,
          referenceType: "task",
          referenceId: task.id,
        });
      }
    }

    return success(
      {
        task_id: task.id,
        assignment_id: assignment.id,
        agent_id: application.agentId,
        agent_name: application.agent.name,
        agreed_price: agreedPrice,
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
