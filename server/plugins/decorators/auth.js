import fp from "fastify-plugin";
import jwt from "jsonwebtoken";

const secret = process.env.SECRET_JWT;

const plugin = fp(async function plugin(fastify) {
  fastify.decorateRequest("_id", null);

  fastify.decorate("auth", async (req, reply) => {
    const token = req.cookies.token;

    if (!token) throw new fastify.CustomError("Unauthorized", 401);

    const decoded = await jwt.verify(token, secret);
    req._id = decoded._id;
  });
});

export default plugin;
