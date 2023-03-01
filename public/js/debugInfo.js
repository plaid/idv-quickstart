import {
  callMyServer,
  showOutput,
  showSelector,
  hideSelector,
} from "./utils.js";
let savedAttemptData;

/**
 * Retrieve some information about our user's most recent Identity
 * Verification attempt, using the idv session ID that we have saved on our
 * server-side database.
 *
 * This is information you'd never want to show to a client explicitly. This
 * is really just a way for you to see the kind of data you'd get back from
 * a /identity_verification/get call.
 */
export const getMostRecent = async function () {
  const idvResults = await callMyServer("/server/debug/show_most_recent_idv");
  if (Object.keys(idvResults).length > 0) {
    showSimpleIDVResults(idvResults);
  } else {
    showOutput("You don't have any Identity Verification attempts yet");
  }
};

/**
 * Use the "/identity_verification/list" call on the sever to fetch all of the
 * Identity Verification attempts for this ID. You'll generally only get more
 * than one of these if you ask to restart the IDV process, either using the
 * API for (more commonly) from the dashboard.
 */
export const getIDVList = async function () {
  savedAttemptData = await callMyServer("/server/debug/fetch_user_idv_list");
  // Populate our select list
  const starterOption = `<option value=""> -- Pick one--  </option>`;
  document.querySelector("#listOfAttempts").innerHTML =
    starterOption +
    savedAttemptData.map((result) => {
      return `<option value="${result["id"]}">${result["created_at"]}</value>`;
    });
  showSelector("#listOfAttempts");
};

/**
 * Populate our debug table based on the saved data we retrieved from our
 * list call
 */
export const newSessionPicked = async function (event) {
  const sessionToShow = document.querySelector("#listOfAttempts").value;
  if (sessionToShow !== "") {
    const idvSession = savedAttemptData.find((e) => e["id"] === sessionToShow);
    if (idvSession != null) {
      showSimpleIDVResults(idvSession);
    }
  }
};

/**
 * Takes our Identity Verification results and displays a simplified version
 * of them to the screen.
 */
const showSimpleIDVResults = function (results) {
  showSelector("#idvAttemptInfo");
  document.querySelector(
    "#idvAttemptSummary"
  ).textContent = `Attempt on ${results["created_at"]}`;
  document.querySelector("#idvAttOverallStatus").textContent =
    results["status"] != null ? showPrettyStep(results["status"]) : "Unknown";
  const selectorsForSteps = {
    "#idvAttTos": "accept_tos",
    "#idvAttSMS": "verify_sms",
    "#idvAttKYC": "kyc_check",
    "#idvAttSMS": "verify_sms",
    "#idvAttRisk": "risk_check",
    "#idvAttDocs": "documentary_verification",
    "#idvAttSelfie": "selfie_check",
  };
  Object.entries(selectorsForSteps).forEach(([selector, resultEntry]) => {
    const thisStep = results["steps"][resultEntry] ?? "---";
    document.querySelector(selector).textContent = showPrettyStep(thisStep);
  });
};

/**
 * Convert the "status" step of an IDV session to a more readable description
 * with a fun emoji. Because emojis make everything better!
 */
const showPrettyStep = function (stepText) {
  const descriptionForStatus = {
    success: "✅ Success",
    active: "⬅️ Active",
    not_applicable: "🤷 n/a",
    waiting_for_prerequisite: "🕗 Waiting",
    failed: "❌ Failed",
    skipped: "🚫 Skipped",
    expired: "📅 Expired",
    canceled: "😡 Canceled",
    pending_review: "✍️ Pending review",
    manually_approved: "🕺 Manually approved",
    manually_rejected: "😩 Manually rejected",
  };
  return descriptionForStatus[stepText] ?? stepText;
};

export const clearDebugSection = function () {
  hideSelector("#idvAttemptInfo");
  document.querySelector("#idvAttOverallStatus").textContent = "";
  document.querySelector("#idvAttemptSummary").textContent = "--Attempt--";
  [
    "#idvAttTos",
    "#idvAttSMS",
    "#idvAttKYC",
    "#idvAttSMS",
    "#idvAttRisk",
    "#idvAttDocs",
    "#idvAttSelfie",
  ].forEach((e) => (document.querySelector(e).textContent = ""));
  document.querySelector("#listOfAttempts").innerHTML = "";
  hideSelector("#listOfAttempts");
};
