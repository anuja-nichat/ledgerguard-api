import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import type { AuthContext } from "../../types/auth";
import { CurrentAuthContext } from "../common/auth-context.decorator";
import { AuthContextGuard } from "../common/auth-context.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  private readonly authService = new AuthService();

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const payload = this.authService.validateLoginPayload(body);
    return this.authService.login(payload);
  }

  @Get("validate")
  @UseGuards(AuthContextGuard)
  validate(@CurrentAuthContext() context: AuthContext) {
    return {
      user: {
        id: context.userId,
        email: context.email,
        role: context.role,
        status: context.status,
      },
    };
  }
}