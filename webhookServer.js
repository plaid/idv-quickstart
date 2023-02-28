const express = require("express");
const bodyParser = require("body-parser");

const serverFunctions = require("./server");

/**
 * This is a separate server running on a different port that we use
 * specifically for receiving webhooks from Plaid. We have this running on
 * a separate server on another port so that it's easier for you to use a
 * tool like ngrok to provide access to just these endpoints from the
 * outside world.
 */
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 8001;
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox").toLowerCase();

const webhookApp = express();
webhookApp.use(bodyParser.urlencoded({ extended: false }));
webhookApp.use(bodyParser.json());

const webhookServer = webhookApp.listen(WEBHOOK_PORT, function () {
  console.log(
    `Webhook receiver is up and running at http://localhost:${WEBHOOK_PORT}/`
  );
});

/**
 * This is the main endpoint set up to receive webhooks from Plaid. It
 * analyzes the product associated with the webhook (a.k.a. the webhook_type)
 * and forwards the request body and code off to the appropriate function.
 */
webhookApp.post("/server/receive_webhook", async (req, res, next) => {
  try {
    console.log("**INCOMING WEBHOOK**");
    console.dir(req.body, { colors: true, depth: null });
    // For extra debugging, uncomment the next line
    // console.dir(req.headers, { colors: true, depth: null });
    const product = req.body.webhook_type;
    const code = req.body.webhook_code;
    switch (product) {
      case "IDENTITY_VERIFICATION":
        handleIdVerWebhook(code, req.body);
        break;
      default:
        console.log(`Can't handle webhook product ${product}`);
        break;
    }
    res.json({ status: "received" });
  } catch (error) {
    next(error);
  }
});

/**
 * This handles any webhooks received by Plaid for the Identity Verification
 * product. We don't do anything with the STEP_UPDATED webhook, beyond make
 * a note that it happened in the logs. When we receive a STATUS_UPDATED webhook,
 * however, we pass the Identity Verification ID to the
 * updateUserRecordForIDVSession() function, which will query Plaid's
 * /identity_verification/get endpoint to retrieve the latest IDV status for
 * this user.
 */
function handleIdVerWebhook(code, requestBody) {
  // We're going to discard all webhooks that aren't part of our environment
  if (requestBody["environment"] !== PLAID_ENV) {
    console.log(`Discarding webhook for ${requestBody["environment"]}`);
    return;
  }
  switch (code) {
    case "STEP_UPDATED":
      console.log(
        `Webhook report: A step has been updated for IDV session ${requestBody["identity_verification_id"]}`
      );
      break;
    case "STATUS_UPDATED":
      const idvSession = requestBody["identity_verification_id"];
      console.log(
        `Webhook report: The status has been updated for IDV session ${idvSession}. Let's update our database.`
      );
      serverFunctions.updateUserRecordForIDVSession(idvSession);
      break;
    default:
      console.log(`I'm not doing anything with the ${code} webhook.`);
      break;
  }
}

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

webhookApp.use(errorHandler);

const getWebhookServer = function () {
  return webhookServer;
};

module.exports = { getWebhookServer };
