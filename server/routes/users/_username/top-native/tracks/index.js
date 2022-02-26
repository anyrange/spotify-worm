import { formatTrack } from "#server/utils/index.js";

export default async function (fastify) {
  fastify.get(
    "",
    {
      schema: {
        params: {
          type: "object",
          required: ["username"],
          properties: { username: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: {
            range: { type: "number", minimum: 1, default: 20 },
            period: {
              type: "string",
              pattern: "^(long_term|medium_term|short_term)$",
              default: "long_term",
            },
          },
        },
        response: {
          200: { $ref: "tracks#" },
        },
        tags: ["top"],
      },
      preHandler: [fastify.getUserInfo],
    },
    async function (req, reply) {
      const user = req.user;
      const { range, period } = req.query;

      const tracks = await fastify.spotifyAPI({
        route: `me/top/tracks?limit=${range}&time_range=${period}`,
        token: user.token,
      });

      reply.send(tracks.items.map((track) => formatTrack(track)));
    }
  );
}
