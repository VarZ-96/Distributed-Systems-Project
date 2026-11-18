import { NotFoundError } from '../models/errors.js';

/**
 * Single Responsibility: administrative user directory & role governance use-cases.
 */
export class AdminService {
  constructor({ userRepository, rbacService }) {
    this.userRepository = userRepository;
    this.rbacService = rbacService;
  }

  async listUsers() {
    return this.userRepository.findAllWithAccessSummary();
  }

  async changeUserRole(targetUserId, newRoleName) {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError('Target user not found');
    }

    const access = await this.rbacService.updateUserRole(targetUserId, newRoleName);
    return {
      ...user.toDTO(),
      roles: access.roles,
      permissions: access.permissions,
    };
  }
}
