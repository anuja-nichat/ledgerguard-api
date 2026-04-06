import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./nest/app.module";
import { ApiExceptionFilter } from "./nest/common/api-exception.filter";
import { ResponseEnvelopeInterceptor } from "./nest/common/response-envelope.interceptor";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://ledgerguard.vercel.app",
  "https://ledgerguard-api-35373.azurewebsites.net",
];

function getAllowedCorsOrigins(rawOrigins: string | undefined): string[] {
  const configuredOrigins = (rawOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_CORS_ORIGINS, ...configuredOrigins])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedCorsOrigins = getAllowedCorsOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedCorsOrigins.includes(origin));
    },
  });

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const rawPort = process.env.PORT ?? "3001";
  const listenTarget = /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
  await app.listen(listenTarget);

  console.log(`Nest API is running on ${String(listenTarget)}/api`);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap Nest API", error);
  process.exit(1);
});