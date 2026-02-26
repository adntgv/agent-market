import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { tasks, taskApplications, taskAssignments, wallets, transactions, notifications } from "@/drizzle/schema";
import { success, error, unauthorized, notFound, serverError } from "@/lib/utils/api";
import { requireAgentAuth } from "@/lib/auth/agent-auth";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/tasks/[id]/apply
 * Agent applies for a task with a bid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await requireAgentAuth(request);

    const body = await request.json();
    const { bid, message = "" } = body;

    // Validation
    if (!bid || parseFloat(bid) <= 0) {
      return error("Invalid bid amount");
    }

    // Get task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        buyer: true,
        assignment: true,
        applications: {
          where: eq(taskApplications.agentId, agent.id),
        },
      },
    });

    if (!task) {
      return notFound("Task not found");
    }

    // Check if task is available
    if (task.status !== "open" && task.status !== "matching") {
      return error("Task is not available for applications", 409);
    }

    // Check if already assigned
    if (task.assignment) {
      return error("Task already assigned to another agent", 409);
    }

    // Check if agent already applied
    if (task.applications && task.applications.length > 0) {
      return error("You have already applied to this task", 409);
    }

    // Check if bid exceeds max budget
    if (parseFloat(bid) > parseFloat(task.maxBudget)) {
      return error(`Bid exceeds maximum budget of ${task.maxBudget}`, 400);
    }

    // Create application
    const [application] = await db
      .insert(taskApplications)
      .values({
        taskId: task.id,
        agentId: agent.id,
        bidAmount: parseFloat(bid).toFixed(2),
        message: message,
        status: "pending",
      })
      .returning();

    // Notify buyer
    await db.insert(notifications).values({
      userId: task.buyerId,
      type: "new_application",
      message: `Agent ${agent.name} applied to your task "${task.title}" with a bid of $${bid}`,
      referenceType: "task",
      referenceId: task.id,
    });

    // If auto_assign is true, automatically assign to this agent
    if (task.autoAssign) {
      // Get buyer's wallet
      const buyerWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, task.buyerId),
      });

      if (!buyerWallet) {
        return error("Buyer wallet not found", 500);
      }

      // Check if buyer has sufficient balance
      const agreedPrice = parseFloat(bid);
      if (parseFloat(buyerWallet.balance) < agreedPrice) {
        return error("Buyer has insufficient funds", 402);
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
          agentId: agent.id,
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

      // Update application status
      await db
        .update(taskApplications)
        .set({
          status: "accepted",
        })
        .where(eq(taskApplications.id, application.id));

      // Notify buyer about auto-assignment
      await db.insert(notifications).values({
        userId: task.buyerId,
        type: "task_assigned",
        message: `Agent ${agent.name} has been auto-assigned to your task: ${task.title}. Price: $${agreedPrice}`,
        referenceType: "task",
        referenceId: task.id,
      });

      return success(
        {
          application_id: application.id,
          task_id: task.id,
          assignment_id: assignment.id,
          agent_id: agent.id,
          agreed_price: agreedPrice,
          status: "assigned",
          auto_assigned: true,
          message: "Application submitted and auto-assigned. Funds locked in escrow.",
        },
        201
      );
    }

    return success(
      {
        application_id: application.id,
        task_id: task.id,
        agent_id: agent.id,
        bid_amount: parseFloat(bid),
        status: "pending",
        message: "Application submitted successfully. Waiting for buyer approval.",
      },
      201
    );
  } catch (err: any) {
    if (err.message === "Invalid or missing API key") {
      return unauthorized(err.message);
    }
    console.error("Error applying for task:", err);
    return serverError(err.message);
  }
}
