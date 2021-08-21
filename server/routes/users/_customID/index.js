import User from "../../../models/User.js";
import mongodb from "mongodb";

const { ObjectId } = mongodb;

export default async function (fastify) {
  const responseSchema = {
    200: {
      type: "object",
      properties: {
        spotifyID: { type: "string" },
        userName: { type: "string" },
        avatar: { type: "string" },
        lastlogin: { type: "string" },
        history: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ...fastify.getSchema("track").properties,
              duration_ms: { type: "number" },
              played_at: { type: "string", format: "date" },
            },
          },
        },
        overview: { $ref: "overview#" },
        top: { $ref: "top#" },
        genres: { type: "array", items: { type: "string" } },
        hourlyActivity: {
          type: "array",
          items: {
            type: "object",
            required: ["time", "playtime", "plays"],
            properties: {
              time: { type: "number" },
              playtime: { type: "number" },
              plays: { type: "number" },
            },
          },
        },
        leaved: { type: "boolean" },
        status: { type: "number" },
      },
    },
  };

  fastify.get(
    "",
    {
      schema: {
        params: {
          type: "object",
          required: ["customID"],
          properties: { customID: { type: "string" } },
        },
        response: responseSchema,
        tags: ["users"],
      },
      preValidation: (req, reply) => fastify.auth(req, reply).catch(() => {}),
    },
    async function (req, reply) {
      const { _id } = req;
      const { customID } = req.params;

      // find both the requesting and the searched user
      const users = await User.find(
        { $or: [{ customID }, { _id }] },
        {
          userName: 1,
          privacy: 1,
          avatar: 1,
          lastLogin: 1,
          customID: 1,
          spotifyID: 1,
          lastSpotifyToken: 1,
          refreshToken: 1,
        }
      );
      const requestor = users.find((user) => user._id == _id);

      const user = users.find((user) => user.customID == customID);
      if (!user) throw new this.CustomError("User not found", 404);

      if (user.privacy === "private" && _id != user._id)
        throw new this.CustomError("Private profile", 403);

      if (user.privacy === "friendsOnly") {
        if (!requestor) throw new this.CustomError("Private profile", 403);
        const [friendProof] = await fastify.spotifyAPI({
          route: `me/following/contains?type=user&ids=${requestor.spotifyID}`,
          token: user.lastSpotifyToken,
        });

        if (!friendProof) throw new this.CustomError("Private profile", 403);
      }

      const requests = [
        fastify.parseTop(user._id, user.lastSpotifyToken, 6),
        fastify.userListeningHistory(user._id, 51),
        User.aggregate([
          { $match: { _id: ObjectId(user._id) } },
          {
            $project: {
              "recentlyPlayed.duration_ms": 1,
              "recentlyPlayed.plays.played_at": 1,
              _id: 0,
            },
          },
          { $unwind: { path: "$recentlyPlayed" } },
          {
            $project: {
              "recentlyPlayed.duration_ms": 1,
              "recentlyPlayed.plays": {
                $size: "$recentlyPlayed.plays",
              },
            },
          },
          {
            $group: {
              _id: {},
              plays: { $sum: "$recentlyPlayed.plays" },
              playtime: {
                $sum: {
                  $multiply: [
                    "$recentlyPlayed.duration_ms",
                    "$recentlyPlayed.plays",
                  ],
                },
              },
            },
          },
        ]).then((body) => {
          if (!body[0]) return { plays: 0, playtime: 0 };
          return {
            plays: body[0].plays,
            playtime: Math.round(body[0].playtime / 1000 / 60),
          };
        }),
        genresTop(user.lastSpotifyToken, fastify.spotifyAPI),
        User.aggregate([
          { $match: { _id: new ObjectId(user._id) } },
          {
            $project: {
              "recentlyPlayed.plays.played_at": 1,
              "recentlyPlayed.duration_ms": 1,
            },
          },
          { $unwind: { path: "$recentlyPlayed" } },
          { $unwind: { path: "$recentlyPlayed.plays" } },
          {
            $addFields: {
              "recentlyPlayed.played_at": {
                $toDate: "$recentlyPlayed.plays.played_at",
              },
            },
          },
          {
            $project: {
              "recentlyPlayed.duration_ms": 1,
              "recentlyPlayed.time": {
                $dateToString: {
                  format: "%H",
                  date: "$recentlyPlayed.played_at",
                },
              },
            },
          },
          {
            $group: {
              _id: { time: "$recentlyPlayed.time" },
              plays: { $sum: 1 },
              playtime: { $sum: "$recentlyPlayed.duration_ms" },
            },
          },
          {
            $project: {
              time: "$_id.time",
              plays: 1,
              playtime: { $round: { $divide: ["$playtime", 60000] } },
              _id: 0,
            },
          },
          { $sort: { time: -1 } },
        ]).then((res) => {
          const hourlyActivity = [];
          for (let i = 1; i <= 24; i++) {
            hourlyActivity.push(
              res.find((hour) => Number(hour.time) === i) || {
                time: i,
                playtime: 0,
                plays: 0,
              }
            );
          }
          return hourlyActivity;
        }),
      ];

      const [top, history, overview, genres, hourlyActivity] =
        await Promise.all(requests);

      const response = {
        spotifyID: user.spotifyID,
        userName: user.userName,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        top,
        history: history.length ? history[0].recentlyPlayed : [],
        overview,
        genres,
        hourlyActivity,
        leaved: user.refreshToken === "",
      };

      reply.send(response);
    }
  );
}

const genresTop = async (token, api) => {
  const artists = await api({
    route: "me/top/artists?time_range=medium_term&limit=50",
    token,
  });

  if (artists.error) return [];
  if (!artists.items.length) return [];
  const genres = artists.items
    .map(({ genres }) => {
      return genres;
    })
    .flat(1);

  let res = genres.reduce((data, curr) => {
    data[curr] = data[curr] ? ++data[curr] : 1;
    return data;
  }, {});

  const genresTop = [];

  Object.entries(res).forEach(([val, numTimes]) => {
    genresTop.push({ genre: val, times: numTimes });
  });

  return genresTop
    .sort(function (a, b) {
      return b.times - a.times;
    })
    .map(({ genre }) => genre)
    .slice(0, 10);
};
