import User from "../../../models/User.js";
import formatTrack from "../../../utils/format-track.js";

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
              track: { $ref: "track" },
              overview: { $ref: "overview#" },
              audioFeatures: { $ref: "audioFeatures#" },
              popularity: { type: "number" },
              preview_url: { type: "string" },
              release_date: { type: "string" },
              duration_ms: { type: "string" },
              lastPlayedAt: { type: "string", format: "date" },
              link: { type: "string" },
              isPlaying: { type: "boolean" },
              isLiked: { type: "boolean" },
              rates: { $ref: "rates#" },
              moreTracks: { $ref: "tracks#" },
              status: { type: "number" },
            },
          },
        },
        tags: ["infopages"],
      },
    },
    async function (req, reply) {
      const { _id } = req;
      const trackID = req.params.id;

      const { lastSpotifyToken: token, country } = _id
        ? await User.findById(_id, "lastSpotifyToken country").lean()
        : await User.findById(
            process.env.SERVICE_ID,
            "lastSpotifyToken country"
          ).lean();

      const time_range = ["long_term", "medium_term", "short_term"];

      const request = [
        fastify.spotifyAPI({ route: `tracks/${trackID}`, token }),
        fastify.spotifyAPI({ route: `audio-features/${trackID}`, token }),
        User.findOne(
          { _id, "recentlyPlayed.id": trackID },
          { "recentlyPlayed.$": 1 }
        ),
        ...time_range.map((range) =>
          fastify.spotifyAPI({
            route: `me/top/tracks?limit=50&time_range=${range}`,
            token,
          })
        ),
        fastify.spotifyAPI({
          route: `me/tracks/contains?ids=${trackID}`,
          token,
        }),
        fastify
          .spotifyAPI({
            route: `me/player/currently-playing?market=${country}`,
            token,
          })
          .catch(() => ({})),
      ];

      const [
        track,
        audioFeatures,
        listenedOne,
        trcLT,
        trcMT,
        trcST,
        [isLiked],
        currentPlayer,
      ] = await Promise.all(request);

      const overview = {
        plays: listenedOne?.recentlyPlayed[0].plays.length || 0,
        playtime:
          Math.round(
            (listenedOne?.recentlyPlayed[0].plays.length *
              listenedOne?.recentlyPlayed[0].duration_ms) /
              60000
          ) || 0,
      };

      const [{ artists }, { tracks: moreTracks }] = await Promise.all([
        fastify.spotifyAPI({
          route: `artists?ids=${track.artists.map(({ id }) => id).join(",")}`,
          token,
        }),
        fastify.spotifyAPI({
          route: `artists/${track.artists[0].id}/top-tracks?market=${country}`,
          token,
        }),
      ]);

      const rates = {
        LT: findPlace(track.name, trcLT),
        MT: findPlace(track.name, trcMT),
        ST: findPlace(track.name, trcST),
      };

      audioFeatures.popularity = track.popularity / 100;

      const response = {
        track: {
          album: { name: track.album.name, id: track.album.id },
          artists: artists.map(({ name, id, images }) => ({
            name,
            id,
            image: images.length ? images[0].url : "",
          })),
          name: track.name,
          image: track.album.images.length ? track.album.images[0].url : "",
        },
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
        popularity: track.popularity,
        link: track.external_urls.spotify,
        release_date: track.album.release_date,
        lastPlayedAt: listenedOne?.recentlyPlayed[0].plays[0].played_at,
        isLiked,
        overview,
        rates,
        audioFeatures,
        isPlaying: currentPlayer.item?.id === trackID,
        moreTracks: moreTracks.map((track) => formatTrack({ track })),
      };

      reply.send(response);
    }
  );
}

const findPlace = (name, { items }) => {
  for (let i = 0; i < items.length; i++) {
    if (items[i].name == name) return i + 1;
  }
  return 0;
};
