import { Controller, Get, Header, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { getOpenApiDocument } from "../../lib/openapi";

function resolveServerUrl(request: Request): string {
  const protocolHeader = request.headers["x-forwarded-proto"];
  const forwardedProtocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader;

  const protocol = (forwardedProtocol ?? request.protocol ?? "http").split(",")[0].trim();
  const host = request.get("host") ?? "localhost:3001";

  return `${protocol}://${host}`;
}

function renderSwaggerUiHtml(openApiUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LedgerGuard API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f8fafc;
      }

      #swagger-ui {
        max-width: 1120px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      SwaggerUIBundle({
        url: "${openApiUrl}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    </script>
  </body>
</html>`;
}

@Controller("docs")
export class DocsController {
  @Get("openapi")
  @Header("cache-control", "no-store")
  getOpenApi(@Req() request: Request) {
    const serverUrl = resolveServerUrl(request);
    return getOpenApiDocument(serverUrl);
  }

  @Get()
  @Header("cache-control", "no-store")
  getDocs(@Req() request: Request, @Query("format") format?: string) {
    const serverUrl = resolveServerUrl(request);
    const openApiDocument = getOpenApiDocument(serverUrl);

    if (format === "json") {
      return {
        success: true,
        data: openApiDocument,
        meta: {},
      };
    }

    const openApiUrl = `${serverUrl}/api/docs/openapi`;
    return renderSwaggerUiHtml(openApiUrl);
  }
}