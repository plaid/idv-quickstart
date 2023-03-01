import { callMyServer, showSelector, hideSelector, resetUI } from "./utils.js";
import { refreshIDVStatus } from "./client.js";

/**
 * Methods to handle signing in and creating new users. Because this is just
 * a sample, we decided to skip the whole "creating a password" thing.
 */

export const createNewUser = async function () {
  const newUsername = document.querySelector("#username").value;
  const newUserEmail = document.querySelector("#email").value;
  await callMyServer("/server/create_new_user", true, {
    username: newUsername,
    email: newUserEmail,
  });
  await refreshSignInStatus();
};

/**
 * Get a list of all of our users on the server.
 */
const getExistingUsers = async function () {
  const usersList = await callMyServer("/server/list_all_users");
  if (usersList.length === 0) {
    hideSelector("#existingUsers");
  } else {
    showSelector("#existingUsers");
    document.querySelector("#existingUsersSelect").innerHTML = usersList.map(
      (userObj) => `<option value="${userObj.id}">${userObj.username}</option>`
    );
  }
};

export const signIn = async function () {
  const userId = document.querySelector("#existingUsersSelect").value;
  await callMyServer("/server/sign_in", true, { userId: userId });
  await refreshSignInStatus();
};

export const signOut = async function () {
  await callMyServer("/server/sign_out", true);
  await refreshSignInStatus();
  resetUI();
};

export const refreshSignInStatus = async function () {
  const userInfoObj = await callMyServer("/server/get_basic_user_info");
  const userInfo = userInfoObj.userInfo;
  if (userInfo == null) {
    showSelector("#notSignedIn");
    hideSelector("#signedIn");
    getExistingUsers();
  } else {
    showSelector("#signedIn");
    hideSelector("#notSignedIn");
    document.querySelector("#welcomeMessage").textContent = `Signed in as ${
      userInfo.username
    } (user ID #${userInfo.id.substr(0, 8)}...)`;
    await refreshIDVStatus();
  }
};
