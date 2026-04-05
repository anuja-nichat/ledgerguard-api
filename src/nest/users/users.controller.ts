import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import {
  assignRoleForAdmin,
  createUserForAdmin,
  deleteUserForAdmin,
  getUserByIdForContext,
  listUsersForAdmin,
  updateUserForAdmin,
} from "../../services/user.service";
import type { AuthContext } from "../../types/auth";
import { CurrentAuthContext } from "../common/auth-context.decorator";
import { AuthContextGuard } from "../common/auth-context.guard";

@Controller("users")
@UseGuards(AuthContextGuard)
export class UsersController {
  @Get()
  async listUsers(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await listUsersForAdmin(context, query);

    return {
      success: true,
      data: {
        users: result.users,
      },
      meta: result.meta,
    };
  }

  @Post()
  async createUser(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: unknown,
  ) {
    const result = await createUserForAdmin(context, body);

    return {
      user: result.user,
    };
  }

  @Get(":id")
  async getUserById(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") userId: string,
  ) {
    const result = await getUserByIdForContext(context, userId);

    return {
      user: result.user,
    };
  }

  @Patch(":id")
  async updateUser(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") userId: string,
    @Body() body: unknown,
  ) {
    const result = await updateUserForAdmin(context, userId, body);

    return {
      user: result.user,
    };
  }

  @Delete(":id")
  @HttpCode(204)
  async deleteUser(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") userId: string,
  ) {
    await deleteUserForAdmin(context, userId);
  }

  @Post(":id/roles")
  @HttpCode(200)
  async assignRole(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") userId: string,
    @Body() body: unknown,
  ) {
    const result = await assignRoleForAdmin(context, userId, body);

    return {
      user: result.user,
    };
  }
}