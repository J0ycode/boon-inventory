import type { Instrumentation } from "next";

/** Next.js calls this for every uncaught server error (pages, server actions, route handlers, proxy). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { reportError } = await import("@/lib/report-error");
  await reportError(error, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
