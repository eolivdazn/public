const { listPhotos, addPhoto, removePhoto } = require("../lib/photo-store");
const { getClientPrincipal } = require("../lib/client-principal");

function json(status, body, extraHeaders = {}) {
  return { status, headers: { "Content-Type": "application/json", ...extraHeaders }, body };
}

function queryValue(req, name) {
  return typeof req.query[name] === "string" ? req.query[name].trim() : "";
}

// GET /api/photos?tripSlug=…            -> the trip's photos, each with a temporary read URL
// POST /api/photos { tripSlug, blobName, caption?, takenOn?, location? } -> add a photo
// DELETE /api/photos?id=…&tripSlug=…    -> remove a photo (and its image)
module.exports = async function photosApi(context, req) {
  const actor = getClientPrincipal(req);

  try {
    if (req.method === "GET") {
      const tripSlug = queryValue(req, "tripSlug");
      if (!tripSlug) {
        context.res = json(400, { error: "'tripSlug' query parameter is required." });
        return;
      }
      const photos = await listPhotos(tripSlug);
      context.res = json(200, { tripSlug, count: photos.length, photos });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const photo = await addPhoto(body, actor);
      context.res = json(201, { message: "Photo added.", photo });
      return;
    }

    if (req.method === "DELETE") {
      const id = queryValue(req, "id");
      const tripSlug = queryValue(req, "tripSlug");
      if (!id || !tripSlug) {
        context.res = json(400, { error: "'id' and 'tripSlug' query parameters are required." });
        return;
      }
      await removePhoto(tripSlug, id, actor);
      context.res = json(200, { message: "Photo deleted." });
      return;
    }

    context.res = json(405, { error: "Method not allowed." }, { Allow: "GET, POST, DELETE" });
  } catch (error) {
    console.error(error);
    context.res = json(400, { error: error.message || "Unable to process photo request." });
  }
};
