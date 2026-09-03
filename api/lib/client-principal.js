function getClientPrincipal(req) {
  const header = req.headers && req.headers["x-ms-client-principal"];
  if (!header) {
    return null;
  }

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const principal = JSON.parse(decoded);
    if (!principal || typeof principal !== "object" || !principal.userId) {
      return null;
    }
    return {
      userId: principal.userId,
      userDetails: principal.userDetails || null,
      identityProvider: principal.identityProvider || null,
      userRoles: Array.isArray(principal.userRoles) ? principal.userRoles : []
    };
  } catch (error) {
    return null;
  }
}

module.exports = { getClientPrincipal };
