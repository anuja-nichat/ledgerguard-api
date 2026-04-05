import { Controller, Get } from "@nestjs/common";

@Controller()
export class ApiRootController {
  @Get()
  getApiRoot() {
    return {
      service: "ledgerguard-api",
      status: "ok",
      endpoints: {
        health: "/api/health",
        docs: "/api/docs",
        openapi: "/api/docs/openapi",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
