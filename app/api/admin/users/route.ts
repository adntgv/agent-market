import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { users, userProfiles } from "@/drizzle/schema";
import { requireRole } from "@/lib/auth/session";
import { success, forbidden, serverError } from "@/lib/utils/api";
import { desc } from "drizzle-orm";

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin");

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const limit = parseInt(searchParams.get("limit") || "50");

    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      limit,
      with: {
        profile: true,
      },
    });

    let filteredUsers = allUsers;
    if (role) {
      filteredUsers = allUsers.filter((u) => u.role === role);
    }

    return success({
      users: filteredUsers.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        email_verified: user.emailVerified,
        total_tasks: user.profile?.totalTasksCompleted || 0,
        rating: parseFloat(user.profile?.rating || "0"),
        created_at: user.createdAt,
      })),
      total: filteredUsers.length,
    });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return forbidden();
    }
    console.error("Error listing users:", err);
    return serverError(err.message);
  }
}
