require("dotenv").config({ quiet: true });
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
const escape = require("escape-html");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const {
  Configuration,
  PlaidEnvironments,
  PlaidApi,
  IDNumberType,
} = require("plaid");

const { getWebhookServer } = require("./webhookServer");

const databaseFile = "./database/appdata.db";
let db;

const APP_PORT = process.env.APP_PORT || 8000;
const ID_VER_TEMPLATE = process.env.TEMPLATE_ID;
const DATA_SOURCE_ONLY_NO_SMS_ID = process.env.DATA_SOURCE_ONLY_NO_SMS_ID;
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox").toLowerCase();

/**
 * Initialization!
 */

// Set up the server

const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

const server = app.listen(APP_PORT, function () {
  console.log(`Server is up and running at http://localhost:${APP_PORT}/`);
});

// Set up our database
const existingDatabase = fs.existsSync(databaseFile);
dbWrapper
  .open({ filename: databaseFile, driver: sqlite3.Database })
  .then(async (dBase) => {
    db = dBase;
    try {
      if (!existingDatabase) {
        // Database doesn't exist yet -- let's create it!
        // Using UUIDs (instead of a simple auto-incrementing integer) for the
        // userID because you might drop and create the table multiple times and
        // this just makes it easier.
        await db.run(
          "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, is_verified BOOLEAN, idv_status TEXT, most_recent_idv_session TEXT)"
        );
      } else {
        console.log("Database is up and running!");
      }
    } catch (dbError) {
      console.error(dbError);
    }
  });

// Set up the Plaid client library
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

/**
 * Methods and endpoints for signing in, signing out, and creating new users.
 * For the purpose of this sample, we're simply setting / fetching a cookie that
 * contains the userID as our way of getting the ID of our signed-in user.
 */

const getLoggedInUserId = function (req) {
  return req.cookies["signedInUser"];
};

const getUserObject = async function (userId) {
  const result = await db.get(`SELECT * FROM users WHERE id="${userId}"`);
  return result;
};

app.post("/server/create_new_user", async (req, res, next) => {
  try {
    const username = escape(req.body.username);
    const email = escape(req.body.email);
    const userId = uuidv4();
    const result = await db.run(
      `INSERT INTO users(id, username, email) VALUES("${userId}", "${username}", "${email}")`
    );
    console.log(`User creation result is ${JSON.stringify(result)}`);
    if (result["lastID"] != null) {
      res.cookie("signedInUser", userId, {
        maxAge: 900000,
        httpOnly: true,
        sameSite: "none",
        secure: "false",
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/server/sign_in", async (req, res, next) => {
  try {
    const userId = escape(req.body.userId);
    res.cookie("signedInUser", userId, {
      maxAge: 900000,
      httpOnly: true,
      sameSite: "none",
      secure: "false",
    });
    res.json({ signedIn: true });
  } catch (error) {
    next(error);
  }
});

app.post("/server/sign_out", async (req, res, next) => {
  try {
    res.clearCookie("signedInUser");
    res.json({ signedOut: true });
  } catch (error) {
    next(error);
  }
});

app.get("/server/list_all_users", async (req, res, next) => {
  try {
    const result = await db.all(`SELECT id, username FROM users`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the id and username of our currently logged in user, if any.
 */
app.get("/server/get_basic_user_info", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    console.log(`Your userID is ${userId}`);
    let result;
    if (userId != null) {
      const userObject = await getUserObject(userId);
      if (userObject == null) {
        // This probably means your cookies are messed up.
        res.clearCookie("signedInUser");
        res.json({ userInfo: null });
        return;
      } else {
        result = { id: userObject.id, username: userObject.username };
      }
    } else {
      result = null;
    }
    res.json({ userInfo: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Fetches the complete user record from the database, including whether or not
 * this user's identity has been verified yet.
 *
 * In a real application, you'd probably want to send a subset of this data back
 * up to the client; not the entire record.
 */
app.get("/server/get_full_user_info", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    let result;
    if (userId != null) {
      result = await getUserObject(userId);
    } else {
      result = null;
    }
    res.json({ fullInfo: result });
  } catch (error) {
    next(error);
  }
});

/**
 * In some cases, you may already have some information about the user, like their
 * name or address. We'll fill that in here to avoid your user having to fill it
 * in twice. It is not your responsibility to verify this data (that's what IDV does),
 * but you should only include it if your UI made it clear your user should be
 * providing you with real data.
 */
app.post("/server/prefill_idv_data", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);

    const response = await plaidClient.identityVerificationCreate({
      is_shareable: false,
      template_id: ID_VER_TEMPLATE,
      is_idempotent: true,
      user: {
        client_user_id: userId,
        name: { family_name: "Knope", given_name: "Leslie" },
        address: {
          street: "123 Main St.",
          city: "Pawnee",
          country: "US",
          region: "IN",
          postal_code: "46001",
        },
        date_of_birth: "1975-01-18",
      },
    });
    const idvSession = response.data.id;
    await updateLatestIDVSession(userId, idvSession);
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

/**
 * Generates a link token to be used by the client for Identity Verification
 * purposes. Note that identity_verification should be the only product listed
 * in the products array, and that it's not necessary to send a webhook URL,
 * since the webhooks for Identity Verification are set in the Plaid dashboard.
 */
app.post("/server/generate_link_token_for_idv", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    // You should always include the users email if you have it, as we use it
    // to perform several different fraud checks. While not required, we
    // recommend that you verify the user's email.
    const { email } = await getUserObject(userId);
    const userObject = { client_user_id: userId };
    if (email != null && email !== "") {
      userObject.email_address = email;
    }
    const tokenResponse = await plaidClient.linkTokenCreate({
      user: userObject,
      products: ["identity_verification"],
      identity_verification: {
        template_id: ID_VER_TEMPLATE,
      },
      client_name: "Baby You Can Buy My Car",
      language: "en",
      country_codes: ["US"],
    });
    res.json(tokenResponse.data);
  } catch (error) {
    console.log(`Running into an error!`);
    next(error);
  }
});

/**
 * This will make a call to /identity_verification/individual/get and update
 * our user database based on the results we get back from that API call.
 *
 * @param {string} idvSession The IDV session that we'll use for updating a
 * user's IDV status.
 * @returns {string} The status of our user's Identity Verification attempt
 */
const updateUserRecordForIDVSession = async (idvSession) => {
  const IDVResult = await plaidClient.identityVerificationGet({
    identity_verification_id: idvSession,
  });
  const IDVData = IDVResult.data;
  console.dir(IDVData, { colors: true, depth: null });
  if (IDVData.status !== "success") {
    // If the status isn't "success", then we can't verify them -- this
    // might not be a failure -- it might just be incomplete.
    // It'll be up to you to decide if you want to mark their is_verified
    // status as `false` if it was previously `true`. This would be pretty
    // unusual.
    await db.run(
      "UPDATE users SET is_verified = ?, idv_status = ?, " +
        "most_recent_idv_session = ? WHERE id = ? ",
      false,
      IDVData.status,
      idvSession,
      IDVData.client_user_id
    );
  } else {
    // If the status is "success", let's populate our database with the values
    // we get back from the endpoint. Note that we're also getting our client
    // id from the endpoint as well instead of getting it from the user cookie
    // -- this avoids the situation of a user trying to send us back another
    // user's IDV session.
    await db.run(
      "UPDATE users SET first_name = ?, last_name = ?, phone = ?, " +
        "is_verified = ?, idv_status = ?,  most_recent_idv_session = ? " +
        " WHERE id = ?",
      IDVData.user.name.given_name,
      IDVData.user.name.family_name,
      IDVData.user.phone_number,
      true,
      IDVData.status,
      idvSession,
      IDVData.client_user_id
    );
  }
  return IDVData.status;
};

/**
 * Takes the latest Identity Verification session ID and stores it with our
 * user in the database.
 * @param {string} userId The internal ID of our signed-in user
 * @param {string} idvSession The session ID of our user's latest Identity
 * Verification attempt
 * @returns
 */
const updateLatestIDVSession = async function (userId, idvSession) {
  const result = await db.run(
    "UPDATE users SET most_recent_idv_session = ? WHERE id = ?",
    idvSession,
    userId
  );
  return result;
};

/**
 * An endpoint that our client can call to set the IDV Session ID for our
 * currently signed-in user. The client will receive this ID throughout the
 * Link process via the `onEvent` callbacks. It's a good idea (although not
 * required) to store this information when you receive it from those events.
 *
 */
app.post("/server/set_recent_idv_session", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    const result = await updateLatestIDVSession(userId, req.body.idvSession);
    res.json({ status: result });
  } catch (error) {
    next(error);
  }
});

/**
 * An endpoint we call when the IDV process is complete -- we'll update our
 * user record based on the results we get back from IDV.
 */
app.post("/server/idv_complete", async (req, res, next) => {
  try {
    const idvSession = req.body.idvSession;
    const sessionStatus = await updateUserRecordForIDVSession(idvSession);
    res.json({ status: sessionStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * Generates a shareable URL that our application can send users to instead of
 * using Link. Typically, shareable URLs are generated manually by your customer
 * service team through the Plaid dashboard, but we're showing this for
 * completeness.
 */
app.post("/server/generate_shareable_url", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    const { email } = await getUserObject(userId);

    const response = await plaidClient.identityVerificationCreate({
      is_shareable: true,
      template_id: ID_VER_TEMPLATE,
      is_idempotent: true,
      user: {
        client_user_id: userId,
        email_address: email,
      },
    });
    const idvSession = response.data.id;
    await updateLatestIDVSession(userId, idvSession);
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

/**
 * With the "Server-side only" flow, we attempt to verify the user's identity
 * purely on the server without any additional steps required by the user.
 *
 * This only works if:
 * a) You have specified a "data source only" verification flow
 * b) You have disabled SMS verification, which you should only do if your app
 * already verifies the user's phone number
 * c) Your application already collects all the information you need to verify
 * the user's identity
 * d) You've created your own consent form that the user has accepted
 */
app.post("/server/server_side_idv", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    const { email } = await getUserObject(userId);

    const response = await plaidClient.identityVerificationCreate({
      is_shareable: false,
      template_id: DATA_SOURCE_ONLY_NO_SMS_ID,
      is_idempotent: true,
      gave_consent: true,
      user: {
        client_user_id: userId,
        email_address: email,
        name: { family_name: "Knope", given_name: "Leslie" },
        address: {
          street: "123 Main St.",
          city: "Pawnee",
          country: "US",
          region: "IN",
          postal_code: "46001",
        },
        date_of_birth: "1975-01-18",
        phone_number: "+12345678909",
        id_number: {
          type: IDNumberType.UsSsnLast4,
          value: "6789",
        },
      },
    });
    const idvSession = response.data.id;
    await updateLatestIDVSession(userId, idvSession);
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

/**
 * This fetches the user's most recent Identity Verification attempt by
 * fetching their session ID from our database, and then making a call to
 * /identity_verification/get.
 *
 * You would not typically share this full set of information with the user.
 */
app.get("/server/debug/show_most_recent_idv", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    const { most_recent_idv_session } = await getUserObject(userId);
    if (most_recent_idv_session == null || most_recent_idv_session == "") {
      res.json({});
      return;
    }
    const IDVResult = await plaidClient.identityVerificationGet({
      identity_verification_id: most_recent_idv_session,
    });
    res.json(IDVResult.data);
  } catch (error) {
    next(error);
  }
});

/**
 * This fetches the complete list of our user's Identity Verification attempts
 * by making a call to /identity_verification/get, passing in our userID.
 * Typically, a user would have more than one attempt if you retry their
 * Identity Verification attempt, either on the dashboard or through the API.
 *
 * You would not typically share this full set of information with the user.
 */
app.get("/server/debug/fetch_user_idv_list", async (req, res, next) => {
  try {
    const userId = getLoggedInUserId(req);
    const IDVResult = await plaidClient.identityVerificationList({
      client_user_id: userId,
      template_id: ID_VER_TEMPLATE,
    });
    // This does contain a cursor in case there's more than 1 page of results.
    // We're going to ignore that for now.
    res.json(IDVResult.data["identity_verifications"]);
  } catch (error) {
    next(error);
  }
});

/**
 * If you don't have webhooks implemented, our server won't really know to
 * update the user record. So this makes our server request the user's latest
 * IDV status from the API and updates our database accordingly.
 */
app.post(
  "/server/debug/pretend_we_received_webhook",
  async (req, res, next) => {
    try {
      const userId = getLoggedInUserId(req);
      // Normally, we could receive the IDV Session ID from the webhook. Here,
      // we'll just look up what we stored in our database
      const { most_recent_idv_session } = await getUserObject(userId);
      const status = await updateUserRecordForIDVSession(
        most_recent_idv_session
      );
      res.json({ status: status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add in some basic error handling so our server doesn't crash if we run into
 * an error.
 */
const errorHandler = function (err, req, res, next) {
  console.error(`Your error:`);
  console.error(err);
  if (err.response?.data != null) {
    res.status(500).send(err.response.data);
  } else {
    res.status(500).send({
      error_code: "OTHER_ERROR",
      error_message: "I got some other message on the server.",
    });
  }
};
app.use(errorHandler);

const webhookServer = getWebhookServer();

exports.updateUserRecordForIDVSession = updateUserRecordForIDVSession;
