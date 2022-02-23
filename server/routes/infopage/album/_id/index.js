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
            type: "object",
            properties: {
              album: { $ref: "entity#" },
              release_date: { type: "string" },
              total_tracks: { type: "number" },
              label: { type: "string" },
              genres: { type: "array", items: { type: "string" } },
              audioFeatures: { $ref: "audioFeatures#" },
              isLiked: { type: "boolean" },
              favouriteTracks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ...fastify.getSchema("track").properties,
                    duration_ms: { type: "number" },
                    lastPlayedAt: { type: "string", format: "datetime" },
                    plays: { type: "number" },
                  },
                },
              },
              status: { type: "number" },
            },
          },
        },
        tags: ["infopages"],
      },
    },
    async function (req, reply) {
      const _id = req.session.get("id");
      const albumID = req.params.id;

      const mainInfo = [fastify.db.Album.findById(albumID).lean()];

      if (_id)
        mainInfo.push(
          fastify.db.User.findById(_id, "tokens.token country").lean()
        );

      let [album, user] = await Promise.all(mainInfo);

      const token = user?.tokens?.token;

      if (!album) {
        const { addAlbum } = await import(
          "#server/includes/cron-workers/historyParser/albums.js"
        );

        album = await addAlbum(albumID, token);
        album.justAdded = true;
      }

      // for unauthenticated users
      if (!token) {
        if (!album.justAdded) {
          import("#server/includes/cron-workers/historyParser/albums.js").then(
            ({ addAlbum }) => addAlbum(albumID)
          );
        }

        return reply.send({
          album: {
            id: album._id,
            name: album.name,
            image: album.images.highQuality,
          },
          ...album,
        });
      }

      const requests = [
        fastify.spotifyAPI({
          route: `me/albums/contains?ids=${albumID}`,
          token,
        }),
        fastify.favouriteTracks({
          _id,
          filterID: albumID,
          type: "album",
        }),
      ];

      const [[isLiked], favouriteTracks] = await Promise.all(requests);

      const response = {
        album: {
          id: albumID,
          name: album.name,
          image: album.images.highQuality,
        },
        ...album,
        isLiked,
        favouriteTracks,
      };

      reply.send(response);
    }
  );
}
