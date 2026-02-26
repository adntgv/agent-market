/**
 * Audit logging for security-critical operations
 * Logs to structured JSON (can be piped to external log service)
 */

export type AuditEventType =
  // Financial operations
  | 'wallet.top_up'
  | 'wallet.withdraw'
  | 'escrow.lock'
  | 'escrow.release'
  | 'escrow.refund'
  // Auth events
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.register'
  | 'auth.register_failed'
  | 'auth.logout'
  | 'agent.api_key_generated'
  | 'agent.api_key_auth_failed'
  // Task operations
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'task.approved'
  | 'task.disputed'
  | 'task.cancelled'
  // Admin actions
  | 'admin.user_updated'
  | 'admin.dispute_resolved'
  | 'admin.task_cancelled'
  // Security events
  | 'security.rate_limit_exceeded'
  | 'security.validation_failed'
  | 'security.suspicious_pattern_detected'
  | 'security.self_dealing_blocked';

export interface AuditLogEntry {
  timestamp: string;
  event: AuditEventType;
  userId?: string;
  agentId?: string;
  ip?: string;
  action: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event
 */
export function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>) {
  const logEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Structured JSON logging (can be piped to external service)
  console.log(JSON.stringify({ audit: logEntry }));
}

/**
 * Log financial operation
 */
export function logFinancialOperation(
  event: Extract<AuditEventType, `wallet.${string}` | `escrow.${string}`>,
  userId: string,
  amount: number,
  details: Record<string, any>,
  ip?: string
) {
  auditLog({
    event,
    userId,
    ip,
    action: event.replace(/\./g, '_'),
    details: {
      amount,
      ...details,
    },
    success: true,
  });
}

/**
 * Log auth event
 */
export function logAuthEvent(
  event: Extract<AuditEventType, `auth.${string}` | `agent.${string}`>,
  details: Record<string, any>,
  success: boolean,
  ip?: string,
  userId?: string,
  errorMessage?: string
) {
  auditLog({
    event,
    userId,
    ip,
    action: event.replace(/\./g, '_'),
    details,
    success,
    errorMessage,
  });
}

/**
 * Log task operation
 */
export function logTaskOperation(
  event: Extract<AuditEventType, `task.${string}`>,
  userId: string,
  taskId: string,
  details: Record<string, any>,
  ip?: string
) {
  auditLog({
    event,
    userId,
    ip,
    action: event.replace(/\./g, '_'),
    details: {
      taskId,
      ...details,
    },
    success: true,
  });
}

/**
 * Log admin action
 */
export function logAdminAction(
  event: Extract<AuditEventType, `admin.${string}`>,
  adminUserId: string,
  details: Record<string, any>,
  ip?: string
) {
  auditLog({
    event,
    userId: adminUserId,
    ip,
    action: event.replace(/\./g, '_'),
    details,
    success: true,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: Extract<AuditEventType, `security.${string}`>,
  details: Record<string, any>,
  userId?: string,
  ip?: string
) {
  auditLog({
    event,
    userId,
    ip,
    action: event.replace(/\./g, '_'),
    details,
    success: false,
  });
}
