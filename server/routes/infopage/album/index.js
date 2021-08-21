import User from "../../../models/User.js";

export default async function (fastify) {
  fastify.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 22, maxLength: 22 } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              album: { $ref: "album#" },
              popularity: { type: "number" },
              link: { type: "string" },
              release_date: { type: "string" },
              total_tracks: { type: "number" },
              label: { type: "string" },
              genres: { type: "array", items: { type: "string" } },
              isLiked: { type: "boolean" },
              favouriteTracks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ...fastify.getSchema("entity").properties,
                    lastPlayedAt: { type: "string" },
                    playtime: { type: "number" },
                    plays: { type: "number" },
                  },
                },
              },
              audioFeatures: { $ref: "audioFeatures#" },
              content: { $ref: "tracks#/definitions/withDuration" },
              status: { type: "number" },
            },
          },
        },
        tags: ["infopages"],
      },
    },
    async function (req, reply) {
      const { _id } = req;
      const albumID = req.params.id;

      const user = _id
        ? await User.findById(_id, "lastSpotifyToken").lean()
        : await User.findById(
            process.env.SERVICE_ID,
            "lastSpotifyToken"
          ).lean();
      if (!user) throw new fastify.CustomError("User not found", 404);
      const token = user.lastSpotifyToken;

      const [album, favouriteTracks, audioFeatures, [isLiked]] =
        await Promise.all([
          fastify.spotifyAPI({
            route: `albums/${albumID}`,
            token,
          }),
          fastify.favouriteTracks(_id, albumID),
          fastify
            .spotifyAPI({ route: `albums/${albumID}/tracks`, token })
            .then(({ items }) => fastify.parseAudioFeatures(items, token)),
          fastify.spotifyAPI({
            route: `me/albums/contains?ids=${albumID}`,
            token,
          }),
        ]);

      const { artists } = await fastify.spotifyAPI({
        route: `artists?ids=${album.artists.map(({ id }) => id).join(",")}`,
        token: token,
      });
      audioFeatures.popularity = album.popularity / 100;
      const response = {
        album: {
          artists: artists.map(({ name, id, images }) => {
            return { name, id, image: images.length ? images[0].url : "" };
          }),
          name: album.name,
          image: album.images.length ? album.images[0].url : "",
        },
        popularity: album.popularity,
        release_date: album.release_date,
        total_tracks: album.total_tracks,
        link: album.external_urls.spotify,
        genres: album.genres,
        label: album.label || "",
        isLiked,
        content: album.tracks.items,
        audioFeatures,
        favouriteTracks,
      };

      reply.send(response);
    }
  );
}
