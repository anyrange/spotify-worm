import fp from "fastify-plugin";
import mongodb from "mongodb";
const { ObjectId } = mongodb;
import User from "../../models/User.js";

export default fp(async function plugin(fastify) {
  fastify.decorate("favouriteTracks", async function (_id, filterId) {
    try {
      const agg = [
        {
          $match: {
            _id: ObjectId(_id),
          },
        },
        {
          $project: {
            recentlyPlayed: 1,
          },
        },
        {
          $unwind: {
            path: "$recentlyPlayed",
          },
        },

        {
          $match: {
            $or: [
              { "recentlyPlayed.artists.id": filterId },
              { "recentlyPlayed.album.id": filterId },
              { "recentlyPlayed.plays.context.id": filterId },
            ],
          },
        },
        {
          $project: {
            plays: { $size: "$recentlyPlayed.plays" },
            playtime: {
              $round: {
                $divide: [
                  {
                    $multiply: [
                      "$recentlyPlayed.duration_ms",
                      { $size: "$recentlyPlayed.plays" },
                    ],
                  },
                  60000,
                ],
              },
            },
            artists: "$recentlyPlayed.artists",
            album: "$recentlyPlayed.album",
            lastPlayedAt: { $first: "$recentlyPlayed.plays.played_at" },
            id: "$recentlyPlayed.id",
            name: "$recentlyPlayed.name",
            image: "$recentlyPlayed.image",
          },
        },
        {
          $sort: {
            plays: -1,
          },
        },
        {
          $limit: 20,
        },
      ];
      return await User.aggregate(agg);
    } catch (e) {
      console.log(JSON.stringify(e));
    }
  });
});