import { z } from 'zod';
import { ValidationError } from '../models/errors.js';

const uuidSchema = z.string().uuid('User ID must be a valid UUID');
const updateRoleBodySchema = z.object({
  role: z.enum(['student', 'admin'], {
    error: "Role must be either 'student' or 'admin'",
  }),
});

/**
 * Thin HTTP adapter for RBAC administration endpoints (`/api/admin/users`).
 * Validates inputs with Zod and delegates governance logic to AdminService.
 */
export class AdminController {
  constructor({ adminService }) {
    this.adminService = adminService;
  }

  listUsers = async (_req, res, next) => {
    try {
      const users = await this.adminService.listUsers();
      return res.status(200).json({ users });
    } catch (error) {
      return next(error);
    }
  };

  updateUserRole = async (req, res, next) => {
    try {
      const idResult = uuidSchema.safeParse(req.params.id);
      if (!idResult.success) {
        throw new ValidationError(idResult.error.issues[0].message);
      }

      const bodyResult = updateRoleBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        throw new ValidationError(bodyResult.error.issues[0].message);
      }

      const updatedUser = await this.adminService.changeUserRole(
        idResult.data,
        bodyResult.data.role
      );

      return res.status(200).json({
        message: `Role updated to '${bodyResult.data.role}' immediately (effective without re-login)`,
        user: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  };
}
