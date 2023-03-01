import {
  createNewUser,
  refreshSignInStatus,
  signIn,
  signOut,
} from "./signin.js";
import {
  callMyServer,
  hideSelector,
  showOutput,
  showSelector,
} from "./utils.js";
import { getIDVList, getMostRecent, newSessionPicked } from "./debuginfo.js";

let linkTokenData;

/**
 * Grab our user's information from the server and update our UI depending on
 * whether or not they've completed the Identity Verification process.
 */
export const refreshIDVStatus = async function () {
  const { fullInfo } = await callMyServer("/server/get_full_user_info");
  if (fullInfo["is_verified"] === 1) {
    showSelector("#verifiedUI");
    hideSelector("#unverifiedUI");
    const personalMessage = `Hello, ${fullInfo.first_name} ${fullInfo.last_name}. You are verified and can start using the app!`;
    document.querySelector("#personalInfo").textContent = personalMessage;
  } else {
    showSelector("#unverifiedUI");
    hideSelector("#verifiedUI");
    showIDVMessageForStatus(fullInfo["idv_status"]);
    fetchLinkTokenForIDV();
  }
};

/**
 * Show an appropriate message for our user's current IDV status, as stored
 * in our database. A status of null means we haven't started the process yet.
 * @param {string} status The user's IDV status, as recorded in the database
 */
const showIDVMessageForStatus = function (status) {
  const statusMsg = document.querySelector("#statusMsg");
  console.log(`Your status is ${status}`);
  const messagesForStatus = {
    active:
      "Please continue verifying your identity. If you're unable to continue, please contact customer service.",
    success:
      "Your identity has been verified! You probably shouldn't be seeing this screen.",
    failed:
      "We couldn't verify your identity. Please contact customer service then click the `Verify my Identity` button to try again.",
    expired:
      "Your identity verification session has expired. Please try again.",
    canceled: "Please continue verifying your identity",
    pending_review:
      "We need to manually review your application. Please contact customer service.",
  };
  if (messagesForStatus[status] != null) {
    statusMsg.textContent = messagesForStatus[status];
    // Since we've already started the IDV process, it's no longer possible to
    // prefill the user's data
    document.querySelector("#runPrefill").classList.add("opacity-50");
    document.querySelector("#runPrefill").disabled = true;
  } else {
    statusMsg.textContent = "Please verify your identity to continue.";
    document.querySelector("#runPrefill").disabled = false;
    document.querySelector("#runPrefill").classList.remove("opacity-50");
  }
};

/**
 * This will tell our server to "prefill" some data for our user before they
 * begin the Identity Verification process.
 */
const prefillData = async function () {
  await callMyServer("/server/prefill_idv_data", true);
  // Fun fact, we don't need to regenerate our Link token!
  const preFillButton = document.querySelector("#runPrefill");
  preFillButton.classList.add("opacity-50");
  preFillButton.disabled = true;
  showOutput(
    "Okay, we're going to pretend you already gave us your full name, birthday, and mailing address, so you don't have to fill it out again."
  );
};

/**
 * Asks the server to generate a URL that we can give to our user to complete
 * the Identity Verification process.
 */
const genShareableUrl = async function () {
  const { shareable_url } = await callMyServer(
    "/server/generate_shareable_url",
    true
  );
  document.querySelector(
    "#urlArea"
  ).innerHTML = `Please visit <a href="${shareable_url}" class="link-info" target="_blank">this link</a> to complete the identity verification process`;
  startPollingForNewStatus();
};

/**
 * Tells the server to attempt a "server-side only" flow, which will attempt to
 * verify our user's identity without any additional user input.
 */
const startIDVServerOnly = async function () {
  await callMyServer("/server/server_side_idv", true);
  startPollingForNewStatus();
};

/**
 * Polls our server to determine if our user has completed the IDV process
 * (and if so, refreshes our interface based on this status)
 */
const startPollingForNewStatus = function () {
  showSelector("#fakeWebhookArea");
  let retryCount = 0;

  const getNewStatus = async function () {
    const { fullInfo } = await callMyServer("/server/get_full_user_info");
    if (fullInfo["idv_status"] == null || fullInfo["idv_status"] === "active") {
      // The user is still going through the IDV process. Let's check back
      // later
      if (retryCount++ < 1000) {
        setTimeout(getNewStatus, 3500);
      }
    } else {
      refreshIDVStatus();
    }
  };

  // Initialize our call
  setTimeout(getNewStatus, 3500);
};

/**
 * Allows us to call an endpoint on our server that runs the same code we'd
 * normally call if we had received a STATUS_UPDATED webhook. Useful in our
 * sample application if we don't have webhooks working.
 */
const fakeWebhook = async function () {
  await callMyServer("/server/debug/pretend_we_received_webhook", true);
};

/**
 * To start Link, the UI widget that handles the IDV flow, we need to fetch
 * a Link token from the user. We'll save this as our `linkTokenData` variable
 * defined at the beginning of our file.
 */
const fetchLinkTokenForIDV = async function () {
  linkTokenData = await callMyServer(
    "/server/generate_link_token_for_idv",
    true
  );
  document.querySelector("#startLinkIDV").classList.remove("opacity-50");
};

/**
 * Start Link and define the callbacks we will call if a user completes the
 * flow or exits early
 */
const startLinkIDV = async function () {
  if (linkTokenData === undefined) {
    return;
  }
  const handler = Plaid.create({
    token: linkTokenData.link_token,
    onSuccess: async (publicToken, metadata) => {
      console.log(`Finished with IDV! ${JSON.stringify(metadata)}`);
      await tellServerUserIsDoneWithIDV(metadata.link_session_id);
      await refreshIDVStatus();
    },
    onExit: async (err, metadata) => {
      console.log(
        `Exited early. Error: ${JSON.stringify(err)} Metadata: ${JSON.stringify(
          metadata
        )}`
      );
      await tellServerUserIsDoneWithIDV(metadata.link_session_id);
      await refreshIDVStatus();
    },
    onEvent: (eventName, metadata) => {
      console.log(`Event ${eventName}, Metadata: ${JSON.stringify(metadata)}`);
      // It's helpful to store the most recent identity verification
      // session for our user
      if (eventName === "IDENTITY_VERIFICATION_START_STEP") {
        callMyServer("/server/set_recent_idv_session", true, {
          idvSession: metadata["link_session_id"],
        });
      }
    },
  });
  handler.open();
};

/**
 * Tell our server that our user is done with IDV -- our server can then
 * make a call to /identity_verification/individual/get to fetch the status
 * of this user and record it in our database.
 *
 * @param {string} linkSessionId The session ID of our current IDV attempt
 */
const tellServerUserIsDoneWithIDV = async function (linkSessionId) {
  await callMyServer("/server/idv_complete", true, {
    idvSession: linkSessionId,
  });
};

// Connect selectors to functions
const selectorsAndFunctions = {
  "#createAccount": createNewUser,
  "#signIn": signIn,
  "#signOut": signOut,
  "#runPrefill": prefillData,
  "#startLinkIDV": startLinkIDV,
  "#getMostRecent": getMostRecent,
  "#getIDVList": getIDVList,
  "#genShareableUrl": genShareableUrl,
  "#startIDVServerOnly": startIDVServerOnly,
  "#fakeWebhook": fakeWebhook,
};

Object.entries(selectorsAndFunctions).forEach(([sel, fun]) => {
  if (document.querySelector(sel) == null) {
    console.warn(`Hmm... couldn't find ${sel}`);
  } else {
    document.querySelector(sel)?.addEventListener("click", fun);
  }
});

document
  .querySelector("#listOfAttempts")
  .addEventListener("change", newSessionPicked);

document.querySelector("#agreeToTOS").addEventListener("change", (e) => {
  if (e.target.checked) {
    document.querySelector("#createAccount").classList.remove("disabled");
  } else {
    document.querySelector("#createAccount").classList.add("disabled");
  }
});

// Enable tooltips
var tooltipTriggerList = [].slice.call(
  document.querySelectorAll('[data-bs-toggle="tooltip"]')
);
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
});

refreshSignInStatus();
