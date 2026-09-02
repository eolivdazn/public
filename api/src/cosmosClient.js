const { CosmosClient } = require("@azure/cosmos");

const DATABASE_ID = process.env.COSMOS_DATABASE_ID || "travel-dashboard";
const CONTAINER_ID = process.env.COSMOS_CONTAINER_ID || "expenses";

let container;

function getContainer() {
  if (!container) {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("COSMOS_CONNECTION_STRING app setting is not configured.");
    }
    container = new CosmosClient(connectionString).database(DATABASE_ID).container(CONTAINER_ID);
  }
  return container;
}

module.exports = { getContainer };
