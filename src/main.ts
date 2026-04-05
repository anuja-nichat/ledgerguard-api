import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./nest/app.module";
import { ApiExceptionFilter } from "./nest/common/api-exception.filter";
import { ResponseEnvelopeInterceptor } from "./nest/common/response-envelope.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  console.log(`Nest API is running on http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap Nest API", error);
  process.exit(1);
});