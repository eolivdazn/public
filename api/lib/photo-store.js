// Trip photos (photos added to a trip, not tied to an expense). The data operations live in
// expense-store.js because they share its Cosmos container (docType "tripPhoto" in the tripSlug
// partition), its blob container, signed read links and audit log; this module is the entry point
// the photos API uses.
const { listPhotos, addPhoto, removePhoto, normalizePhotoInput, TRIP_PHOTO_DOC_TYPE } = require("./expense-store");

module.exports = { listPhotos, addPhoto, removePhoto, normalizePhotoInput, TRIP_PHOTO_DOC_TYPE };
