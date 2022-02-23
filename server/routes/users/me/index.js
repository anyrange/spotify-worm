export default async function (fastify) {
  fastify.get(
    "",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "number" },
              avatar: { type: "string" },
              username: { type: "string" },
              display_name: { type: "string" },
              country: { type: "string" },
            },
          },
        },
        tags: ["users"],
      },
      preValidation: [fastify.auth],
    },
    async function (req, reply) {
      const id = req.session.get("id");

      const user = await fastify.db.User.findByIdAndUpdate(id, {
        lastLogin: Date.now(),
      })
        .select("settings display_name country avatar")
        .lean();

      if (!user) throw fastify.error("User not found", 404);

      user.username = user.settings.username;

      reply.send(user);
    }
  );
}
