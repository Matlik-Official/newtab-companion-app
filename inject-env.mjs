import fs from "fs";

const out = `
export const ENV = {
  SPOTIFY_CLIENT_ID: "${process.env.SPOTIFY_CLIENT_ID}",
  SPOTIFY_REDIRECT_URL: "${process.env.SPOTIFY_REDIRECT_URL}",
  SPOTIFY_REDIRECT_PORT: "${process.env.SPOTIFY_REDIRECT_PORT}"
};
`;

fs.writeFileSync("./electron/env.js", out);
console.log("Injected build-time env into electron/env.js");
