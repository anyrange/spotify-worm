import { addImage } from "#server/utils/index.js";

export default async function (fastify) {
  fastify.get(
    "",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 22, maxLength: 22 } },
        },
        response: {
          200: {
            type: "array",
            items: { $ref: "entities#" },
          },
        },
        tags: ["infopages"],
      },
    },
    async function (req, reply) {
      const artistID = req.params.id;

      const token = await fastify.getRandomToken();

      const artists = await fastify.spotifyAPI({
        route: `artists/${artistID}/related-artists`,
        token,
      });

      reply.send(artists.relatedArtists.map((artist) => addImage(artist, 1)));
    }
  );
}
