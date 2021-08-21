export default async function (fastify) {
  fastify.addHook(
    "preValidation",
    async (req, reply) => await fastify.auth(req, reply).catch(() => {})
  );

  fastify.addHook("onSend", (request, reply, payload, next) => {
    if (reply.statusCode === 200)
      reply.header("Cache-Control", "public, max-age=20");
    next();
  });
}
