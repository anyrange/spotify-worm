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
              playlist: { $ref: "entity#" },
              collaborative: { type: "boolean" },
              followers: { type: "number" },
              link: { type: "string" },
              public: { type: "boolean" },
              totalTracks: { type: "number" },
              owner: { $ref: "entity#" },
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
      const playlistID = req.params.id;

      const {
        lastSpotifyToken: token,
        customID,
        spotifyID,
      } = _id
        ? await User.findById(_id, "lastSpotifyToken customID spotifyID")
        : await User.findById(
            process.env.SERVICE_ID,
            "lastSpotifyToken customID spotifyID"
          ).lean();

      const [playlist, favouriteTracks, [isLiked]] = await Promise.all([
        fastify.spotifyAPI({
          route: `playlists/${playlistID}?fields=collaborative,external_urls,followers(total),images,name,owner(display_name,id),public,tracks(total),tracks(items(track(id,name,album(id,name,images(url)),artists(id,name))))`,
          token,
        }),
        fastify.favouriteTracks(_id, playlistID),
        fastify.spotifyAPI({
          route: `playlists/${playlistID}/followers/contains?ids=${spotifyID}`,
          token,
        }),
      ]);

      const audioFeatures = await fastify.parseAudioFeatures(
        playlist.tracks.items.map(({ track }) => track),
        token
      );

      const response = {
        playlist: {
          name: playlist.name,
          image: playlist.images.length ? playlist.images[0].url : "",
        },
        collaborative: playlist.collaborative,
        link: playlist.external_urls.spotify,
        followers: playlist.followers.total,
        owner: { name: playlist.owner.display_name, id: customID },
        public: playlist.public,
        totalTracks: playlist.tracks.total,
        isLiked,
        audioFeatures,
        content: playlist.tracks.items.map(({ track }) => formatTrack(track)),
        favouriteTracks,
      };

      reply.send(response);
    }
  );
}

const formatTrack = (track) => {
  return Object.assign(track, {
    image:
      track.album.images && track.album.images.length
        ? track.album.images[1].url
        : "",
  });
};
