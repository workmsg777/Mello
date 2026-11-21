// Offline QA-only session issuer. There is no application login bypass endpoint.
const path = require("node:path");
const {
  PROJECT,
  RESULTS,
  loadApplication,
  writeJson,
} = require("./runtime.cjs");

async function issueQaSession(username, application, allowInactive = false) {
  if (!/^qa(?:0[0-9]{4}|10000)$/.test(username) || username === "qa00000")
    throw new Error("Use an inserted username qa00001..qa10000");
  const { sequelize: db, require: req } = application;
  const { QueryTypes } = req("sequelize");
  const [user] = await db.query(
    'SELECT q.username,q.user_id AS "userId",u.account_id AS "accountId",a.status FROM qa_fixture_users q JOIN users u ON u.id=q.user_id JOIN accounts a ON a.id=u.account_id WHERE q.username=:username',
    { replacements: { username }, type: QueryTypes.SELECT },
  );
  if (!user)
    throw new Error("QA fixture user not found; seed the QA database first");
  if (user.status !== "ACTIVE" && !allowInactive)
    throw new Error(
      "This QA fixture is intentionally inactive; choose an active user",
    );
  const { TokenService } = req(
    path.join(PROJECT, "backend/src/services/auth/token.service.ts"),
  );
  const { AuthenticationRepository } = req(
    path.join(PROJECT, "backend/src/repositories/authentication.repository.ts"),
  );
  const { authConfig } = req(path.join(PROJECT, "backend/src/config/auth.ts"));
  const tokens = new TokenService(),
    repository = new AuthenticationRepository();
  const refreshToken = tokens.createRefreshToken();
  const session = await db.transaction((transaction) =>
    repository.createSession(
      user.accountId,
      tokens.hashRefreshToken(refreshToken),
      new Date(Date.now() + authConfig.refreshTokenTtlSeconds * 1000),
      { deviceName: "Standalone QA helper", platform: "WEB" },
      { ipAddress: "127.0.0.1", userAgent: "Mello QA" },
      transaction,
    ),
  );
  return {
    username,
    account: {
      id: user.accountId,
      accountType: "DATING_USER",
      status: user.status,
    },
    profile: { userId: user.userId },
    sessionId: session.id,
    tokens: {
      accessToken: tokens.createAccessToken({
        accountId: user.accountId,
        accountType: "DATING_USER",
        sessionId: session.id,
      }),
      refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: authConfig.accessTokenTtlSeconds,
      refreshTokenExpiresIn: authConfig.refreshTokenTtlSeconds,
    },
    issuedAt: new Date().toISOString(),
  };
}
async function main() {
  const app = loadApplication();
  try {
    const username = process.argv[2] || "qa00001",
      result = await issueQaSession(username, app);
    const file = path.join(RESULTS, "credentials", `${username}.json`);
    writeJson(file, result);
    const browserSession = {
      account: result.account,
      profile: result.profile,
      tokens: result.tokens,
    };
    require("node:fs").writeFileSync(
      path.join(RESULTS, "credentials", `${username}.browser.js`),
      "// Paste only in the local QA dating web app console. Uses the normal existing session storage key.\n" +
        `localStorage.setItem('mello.auth.session.v1', ${JSON.stringify(JSON.stringify(browserSession))});\nlocation.reload();\n`,
    );
    console.log(
      `QA session written to ${file}. Access token expires in ${result.tokens.accessTokenExpiresIn} seconds; rerun to renew. No SMS was sent.`,
    );
  } finally {
    await app.sequelize.close();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { issueQaSession };
