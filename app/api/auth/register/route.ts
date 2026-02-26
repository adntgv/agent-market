import { NextRequest } from "next/server";
import { db } from "@/drizzle/db";
import { users, userProfiles, wallets } from "@/drizzle/schema";
import { success, error, serverError } from "@/lib/utils/api";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { validateEmail, validateStringLength } from "@/lib/security/validate";
import { sanitizeString } from "@/lib/security/sanitize";
import { logAuthEvent, logSecurityEvent } from "@/lib/security/audit-log";
import { getClientIp } from "@/lib/security/rate-limit";

// Password strength validation
function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (password.length > 128) {
    throw new Error("Password too long (max 128 characters)");
  }
  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    throw new Error("Password is too common. Please choose a stronger password.");
  }
}

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    const body = await request.json();
    const { email, username, password, account_type } = body;

    // Validation
    if (!email || !username || !password) {
      return error("Missing required fields: email, username, password");
    }

    // Validate and sanitize inputs
    let validatedEmail: string;
    let sanitizedUsername: string;
    
    try {
      validatedEmail = validateEmail(email);
      sanitizedUsername = validateStringLength(sanitizeString(username), 3, 50, 'username');
      validatePassword(password);
    } catch (validationError: any) {
      logSecurityEvent(
        'security.validation_failed',
        {
          reason: 'registration_validation_failed',
          error: validationError.message,
        },
        undefined,
        ip
      );
      return error(validationError.message);
    }

    const role = account_type || "human"; // Default to human

    if (!["human", "agent", "admin"].includes(role)) {
      return error("Invalid account_type. Must be 'human', 'agent', or 'admin'");
    }

    // Use database transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Check if user exists
      const existingUser = await tx.query.users.findFirst({
        where: eq(users.email, validatedEmail),
      });

      if (existingUser) {
        throw new Error("Email already registered");
      }

      const existingUsername = await tx.query.users.findFirst({
        where: eq(users.username, sanitizedUsername),
      });

      if (existingUsername) {
        throw new Error("Username already taken");
      }

      // Hash password with bcrypt cost 10 (good for security)
      const passwordHash = await hash(password, 10);

      // Create user
      const [user] = await tx
        .insert(users)
        .values({
          email: validatedEmail,
          username: sanitizedUsername,
          passwordHash,
          role,
          emailVerified: false,
        })
        .returning();

      // Create profile
      await tx.insert(userProfiles).values({
        userId: user.id,
        bio: "",
        tags: [],
      });

      // Create wallet
      await tx.insert(wallets).values({
        userId: user.id,
        balance: "0.00",
        escrowBalance: "0.00",
      });

      return user;
    });

    // Audit log
    logAuthEvent(
      'auth.register',
      {
        userId: result.id,
        email: validatedEmail,
        username: sanitizedUsername,
        role,
      },
      true,
      ip,
      result.id
    );

    return success(
      {
        user: {
          id: result.id,
          email: result.email,
          username: result.username,
          role: result.role,
          created_at: result.createdAt,
        },
      },
      201
    );
  } catch (err: any) {
    // Log failed registration
    logAuthEvent(
      'auth.register_failed',
      {
        error: err.message,
      },
      false,
      ip,
      undefined,
      err.message
    );
    
    console.error("Error registering user:", err);
    return serverError(err.message);
  }
}
