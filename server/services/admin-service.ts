import { storage } from "../storage";
import { ValidationError } from "../utils/validation";
import { USER_ROLES, ERROR_MESSAGES } from "../constants/auth";
import type { User } from "@shared/schema";

export class AdminService {
  static async getAllUsers(): Promise<User[]> {
    return await storage.getAllUsers();
  }

  static async updateUserRole(userId: string, newRole: string, currentUserId: string): Promise<User> {
    this.validateRoleUpdate(userId, newRole, currentUserId);
    
    if (newRole === USER_ROLES.USER) {
      await this.ensureNotLastAdmin(userId);
    }
    
    const updatedUser = await storage.updateUser(userId, { role: newRole });
    if (!updatedUser) {
      throw new ValidationError(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    
    return updatedUser;
  }

  private static validateRoleUpdate(userId: string, role: string, currentUserId: string): void {
    if (!Object.values(USER_ROLES).includes(role as any)) {
      throw new ValidationError(ERROR_MESSAGES.INVALID_ROLE);
    }
    
    if (userId === currentUserId) {
      throw new ValidationError(ERROR_MESSAGES.CANNOT_CHANGE_OWN_ROLE);
    }
  }

  private static async ensureNotLastAdmin(userIdToUpdate: string): Promise<void> {
    const allUsers = await storage.getAllUsers();
    const adminCount = allUsers.filter(user => 
      user.role === USER_ROLES.ADMIN && user.id !== userIdToUpdate
    ).length;
    
    if (adminCount === 0) {
      throw new ValidationError(ERROR_MESSAGES.CANNOT_REMOVE_LAST_ADMIN);
    }
  }
}