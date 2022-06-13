export const createServerResponse = (body: unknown) =>
  Promise.resolve(
    new Response(body ? JSON.stringify(body) : null, {
      status: body ? 200 : 204,
      headers: body
        ? { "content-type": "application/json; charset=utf-8" }
        : {},
    }),
  );

export const createServerAuthenticationResponse = (auth: unknown) =>
  createServerResponse(auth ? { authentication: auth } : null);
