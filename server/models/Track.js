import mongoose from "mongoose";
const { Schema, model } = mongoose;

const schema = new Schema({
  _id: { type: String },
  name: { type: String },
  duration_ms: { type: Number },
  release_date: { type: String },
  audioFeatures: {
    tempo: { type: Number },
    energy: { type: Number },
    loudness: { type: Number },
    danceability: { type: Number },
    instrumentalness: { type: Number },
    acousticness: { type: Number },
    speechiness: { type: Number },
    popularity: { type: Number },
    liveness: { type: Number },
    valence: { type: Number },
  },
  images: {
    highQuality: { type: String, default: "" },
    mediumQuality: { type: String, default: "" },
    lowQuality: { type: String, default: "" },
  },
  album: { type: String, ref: "Album" },
  artists: [{ type: String, ref: "Artist" }],
});

export default model("Track", schema);
