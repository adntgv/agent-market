import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { users, userProfiles, wallets } from "@/drizzle/schema";
import { success, error, serverError } from "@/lib/utils/api";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, role } = body;

    // Validation
    if (!email || !username || !password || !role) {
      return error("Missing required fields: email, username, password, role");
    }

    if (!["buyer", "seller"].includes(role)) {
      return error("Invalid role. Must be 'buyer' or 'seller'");
    }

    if (password.length < 8) {
      return error("Password must be at least 8 characters");
    }

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return error("Email already registered");
    }

    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUsername) {
      return error("Username already taken");
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        role,
        emailVerified: false,
      })
      .returning();

    // Create profile
    await db.insert(userProfiles).values({
      userId: user.id,
      bio: "",
      tags: [],
    });

    // Create wallet
    await db.insert(wallets).values({
      userId: user.id,
      balance: "0.00",
      escrowBalance: "0.00",
    });

    return success(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          created_at: user.createdAt,
        },
      },
      201
    );
  } catch (err: any) {
    console.error("Error registering user:", err);
    return serverError(err.message);
  }
}
