import User from "../../models/User.js";

export default async function(fastify) {
  const headers = fastify.getSchema("cookie");

  const responseSchema = {
    200: {
      type: "object",
      required: ["overview", "status"],
      properties: {
        track: {
          type: "object",
          required: [
            "name",
            "image",
            "popularity",
            "release_date",
            "duration_ms",
            "link",
            "album",
            "artists",
            "preview_url",
          ],
          properties: {
            name: {
              type: "string",
            },
            image: {
              type: "string",
            },
            popularity: {
              type: "number",
            },
            release_date: {
              type: "string",
            },
            duration_ms: {
              type: "number",
            },
            preview_url: {
              type: "string",
            },
            link: {
              type: "string",
            },
            artists: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "id"],
                properties: {
                  name: { type: "string" },
                  id: { type: "string" },
                },
              },
            },
            album: {
              type: "object",
              required: ["name", "id"],
              properties: {
                name: { type: "string" },
                id: { type: "string" },
              },
            },
          },
        },
        overview: {
          type: "object",
          required: ["plays", "playtime"],
          properties: {
            plays: { type: "number" },
            playtime: { type: "number" },
          },
        },
        status: {
          type: "number",
        },
      },
    },
  };

  fastify.get(
    "/:id",
    {
      schema: {
        headers,
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              minLength: 22,
              maxLength: 22,
            },
          },
        },
        response: responseSchema,
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
        const trackID = req.params.id;

        const user = await User.findOne(
          { _id, "recentlyPlayed.id": trackID },
          {
            lastSpotifyToken: 1,
            "recentlyPlayed.$": 1,
          }
        );
        if (!user)
          return reply.code(404).send({ message: "Not found", status: 404 });

        const track = await fastify.spotifyAPI({
          route: `tracks/${trackID}`,
          token: user.lastSpotifyToken,
        });

        if (track.error)
          return reply.code(track.error.status || 500).send({
            message: track.error.message,
            status: track.error.status || 500,
          });

        const overview = {
          plays: user.recentlyPlayed[0].plays.length,
          playtime: Math.round(
            (user.recentlyPlayed[0].plays.length *
              user.recentlyPlayed[0].duration_ms) /
              60000
          ),
        };
        const response = {
          track: {
            album: {
              name: track.album.name,
              id: track.album.id,
            },
            artists: track.artists.map(({ name, id }) => {
              return { name, id };
            }),
            name: track.name,
            preview_url: track.preview_url,
            popularity: track.popularity,
            image: track.album.images.length ? track.album.images[0].url : "",
            link: track.external_urls.spotify,
            duration_ms: track.duration_ms,
            release_date: track.album.release_date,
          },
          overview,
          status: 200,
        };

        reply.code(200).send(response);
      } catch (e) {
        reply.code(500).send({ message: "Something went wrong!", status: 500 });
        console.log(e);
      }
    }
  );
}
