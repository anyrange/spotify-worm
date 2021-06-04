import User from "../../../models/User.js";

export default async function(fastify) {
  const headers = fastify.getSchema("cookie");
  fastify.delete(
    "/",
    {
      schema: {
        headers,
        body: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                minLength: 22,
                maxLength: 22,
              },
            },
          },
        },
        response: {
          XXX: {
            type: "object",
            required: ["message", "status"],
            properties: {
              message: {
                type: "string",
              },
              status: {
                type: "number",
              },
            },
          },
        },
      },
      attachValidation: true,
    },
    async function(req, reply) {
      try {
        if (req.validationError) {
          const { status, message } = fastify.validate(req.validationError);
          return reply.code(status).send({ message, status });
        }

        const _id = await fastify.auth(req.cookies.token);

        const opResult = await User.updateOne(
          { _id },
          {
            $pull: { "subscriptions.smartPlaylist": { $in: req.body.items } },
          }
        );

        if (opResult.n === 0)
          return reply.code(400).send({ message: "Error", status: 400 });

        if (opResult.nModified === 0)
          return reply
            .code(400)
            .send({ message: "Nothing to delete", status: 400 });

        return reply
          .code(200)
          .send({ message: "Succesfully updated", status: 200 });
      } catch (e) {
        reply.code(500).send({ message: "Something went wrong!", status: 500 });
        console.log(e);
      }
    }
  );
}