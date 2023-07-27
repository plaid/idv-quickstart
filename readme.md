# Identity Verification Sample App

## Background

This fictional used car marketplace application shows you how to verify a user's
identity using Plaid Identity Verification. This application uses NodeJS on the
backend, and vanilla JavaScript on the frontend.

# Installation

We recommend having node version 16.x.x or later before attempting to run this
application.

## 1. Make sure you have access to Identity Verification

First, if you haven't already done so, 
[sign up for your free Plaid API keys](https://dashboard.plaid.com/signup).

You may not have access to Identity Verification initially. Confirm your access
in the Plaid Dashboard by selecting the dropdown list on the upper left with
your team name. If you see "Identity Verification & Monitor" as one of the
options, you have access. Otherwise, talk to your account manager or
[file a support ticket](https://dashboard.plaid.com/support) to request access
to Identity Verification.

## 2. Clone the repository

Using https:

```
git clone https://github.com/plaid/idv-quickstart
cd idv-quickstart
```

Alternatively, if you use ssh:

```
git clone git@github.com:plaid/idv-quickstart.git
cd idv-quickstart
```

## 3. Install the required packages

Run `npm install` inside your directory to install of the Node packages required
for this application to run.

## 4. Create an Identity Verification template if you don't have one already

1. Head over to the "Identity Verification and Monitor" section of the dashboard
   (you can find it in the drop-down list on the upper left).
2. Select "Switch to Sandbox" on the bottom left of your screen to set up a
   template in Sandbox mode
3. If there's already an Identity Verification template you want to use, you can
   skip ahead to the next section.
4. Otherwise, click the **New Template** button.
5. Fill out the **Setup** form however you'd like. We checked **Attempt to auto-fill customer PII** because it's fun to see. :) Note that you are required to
enter a real working URL as your privacy policy link. You should
   also leave **Verify Phone Number with SMS** checked -- you would only uncheck
   this if your application already verifies the user's phone number through a
   separate mechanism.
6. Pick any color you'd like on the **Design** screen.
7. For the **Workflow**, you can configure  the behavior you'd like to see under Workflow Management.

     PII Verification
   - Lightning verification works by comparing the user's verified phone number
     and information again several data sources.
   - Document verification asks your user to take pictures of documentation such
     as drivers licenses or passports.
   - Select whatever workflow you would like to see. **Fallback to document**
     verification is a common option, but you could also select **Require both
     lightning and document verification** if you wish to experience the entire
     Identity Verification process. You can always change this later.

   Selfie Behavior 
   - Selfie check asks your user to verify they are a real person by capturing
     footage of themselves on their phone. Sandbox mode doesn't use selfie so the
     Selfie Behavior you select doesn't really matter.

8. You can leave **Rulesets** with the default values for now, but we'll come
   back to this soon.
9. Click **Publish changes** and exit the editor.

## 5. Set up your environment variables

Copy `.env.template` to a new file called `.env`. Then open up `.env` in your
favorite code editor and fill out the values.

```
cp .env.template .env
```

You can get your `PLAID_CLIENT_ID` and `PLAID_SECRET` values from Keys section
of the [Plaid dashboard](https://dashboard.plaid.com/account/keys)

You can keep `sandbox` as your environment.

For `TEMPLATE_ID`, we'll need the ID of the Identity Verification template that
you created above. You can do this by selecting your template from the
[templates screen](https://idv-playground.plaid.com/flow/templates/), selecting
the template you created, and then clicking the **Integration** button on top.

You can leave `LIGHTNING_ONLY_NO_SMS_ID` blank for now. We'll return to this in
a future step.

**NOTE:** .env files are a convenient local development tool. Never run a
production application using an environment file with secrets in it. Use some
kind of Secrets Manager (provided by most commercial cloud providers) instead

## 6. (Optional) Set up your webhook receiver

This application makes use of webhooks in certain flows so that it can receive
messages from Plaid that the user is done with their Identity Verification
process. If you want to see this part of the application in action, you will
need to tell Plaid what webhook receiver it should send these messages to.

### Step 1: Create a public endpoint for your webhook receiver

This webhook receiver will need to be available to the public in order for Plaid
to communicate with it. If you don't wish to publish this sample application to
a public server, one common option is to use a tool like
[ngrok](https://ngrok.com/) to open up a tunnel from the outside world to a
specific port running on `localhost`.

The sample application users a separate server to receive webhooks running on
port 8001, so if you have ngrok installed, you can run

```
ngrok http 8001
```

to open up a tunnel from the outside world to this server. The final URL will be
the domain that ngrok has created, plus the path `/server/receive_webhook`. It
will probably look something like:

`https://abde-123-4-567-8.ngrok.io/server/receive_webhook`

### Step 2: Configure Plaid to talk to this endpoint

Unlike many other Plaid products, you won't configure the webhook URL when
creating an Item. Instead, you'll use the Plaid dashboard at
https://dashboard.plaid.com/team/webhooks to tell Plaid what endpoint to call
when sending webhooks. From this page:

- Click **New webhook**.
- Select **Identity verification status updated** as the event. (That's
  _status_, not _step_.)
- Add the URL that you created in the previous step.
- Click **Configure**

You can also repeat the process for the "step updated" and "retried" events if
you want to see them in action, although our application doesn't do anything
with these.

At this point, any webhooks called by Identity Verification will be sent to the
URL you specified. If you ever restart ngrok and end up with a new domain, make
sure to add the new webhook to the dashboard.

The code that is used to process these endpoints is contained in the
`webhookServer.js` file.

## 7. Run the application!

You can run your application by typing

```
npm run watch
```

on the command line. If there are no issues, you should see a message telling
you that you can open up http://localhost:8000/ to view your running app!

# Running the application

Baby You Can Buy My Car is a fictional marketplace app that requires users to
verify their identity before they can fully sign up for the app. This sample
application simulates four different ways that a user could verify their
identity. Obviously, in a real app, you wouldn't present all four options to a
user; this is just for demonstration purposes.

Create an account or sign in with a existing account to start the process.

## 1. The Standard flow

The Standard flow involves users verifying their identity through Link, the
client-side widget that Plaid provides to developers that handles most of the UI
work for you.

To activate the standard flow, click the **Verify My Identity** button. If you
are running in Sandbox mode, Plaid Identity Verification will only accept one
identity, that of Leslie Knope with the values specified
[here](https://plaid.com/docs/identity-verification/testing/). The UI in Sandbox
mode will also give you these values in the upper-right side of the screen.

With Lightning verification, if you fill out these values correctly, your
identity will be accepted.

If you fill out these values incorrectly (and have selected the appropriate
workflow), Identity Verification will fall back to Document verification.

In Document verification, you will be asked to take pictures of an appropriate
piece of identification using your phone. In the Sandbox environment, the
application will assume you always submit a valid drivers license
with the same name and date of birth as that of our test user. (Leslie Knope,
January 18, 1975)

So if you wish to see what a "failed Lightning, but passed Documentation" flow
looks like, try entering a different phone number, social security number,
and/or address, but make sure to enter the correct name and birthday.

### How it works

You should view the code for the full details, but essentially:

1. If the client sees that our user's identification has not yet been verified
   (just by checking our application's database), it requests a Link token from
   the server.
2. The server generates a Link token using the `/link/token/create` endpoint,
   and passes this token back up to the client.
3. Once the user is done with Link (either successfully or not), the client will
   receive an Identity Verification session ID. It sends this session ID to the
   server.
4. The server then makes a call to `/identity_verification/get` with this
   session ID. It will receive information about the user's verification
   attempt, like whether it was successful or not, the userID associated with
   this session, and information like the user's full name and mailing address.
5. The server records the status of the user's verification attempt, this
   session ID and, if the attempt was successful, additional details about the
   user, in its database.
6. Note that if you are using webhooks, your server will also receive this
   verification session ID as a webhook. It will repeat steps 4 and 5 when that
   happens, which technically isn't necessary.

### Email address

If you have the user's email address, you should include it when creating the
link token in step 2 -- Identity Verification runs a number of different fraud
checks against this email. It is considered best practice to verify the user's
email address before submitting it, something we are not doing in our sample
app.

### Seeing Identity Verification details

If you want to see more details about a user's latest Identity Verification
attempt, the best place to do this would be the Identity Verification section of
the Plaid Dashboard. Click into the verificaiton template you used in the demo. From there, you'll be able to see full details about every
user attempt by status: What they entered, why they might have failed, and you can perform
important actions like ask your user to retry different steps.

You can also see details about a user's Identity Verification attempts by
expanding the "Debug Tools" section and clicking the "See my most recent
attempt" button or the "See all my IDV attempts" button. The former will have
our server make a call to `/identity_verification/get` (passing along the most
recent IDV session ID, which we fetch from our database). The latter will have
our server make a call to `/identity_verification/list` (passing along the
user's ID).

We summarize these results on screen, but you can also look at your browser's
JavaScript console to see the full object that gets returned from these calls.

These Debug Tools are there to demonstrate what kind of results you might get
back from `/identity_verification/get` and `/identity_verification/list`. It
would be rare for a typical client application to make calls to these endpoints
or share this information with the user.

### Retrying Identity Verification attempts

Once a user has completed an Identity Verification attempt, they typically
cannot retry it without you, the developer, initiating it on their behalf. To do
this, select the user's Identity Verification attempt in the Plaid dashboard
(whether it has succeeded or failed) and click the **Request Retry** option
underneath their name. You can choose to retry the entire attempt from the
beginning, or perform a special Identity Verification flow.

Note that requesting a retry will create a new Identity Verification session.
You can see a list of all of the user's Identity Verification sessions by
looking at the results of the `/identity_verification/list` call, as described
above.

### Is Identity Verification Failing?

As you're testing Identity Verification, you might notice that your attempts
start to fail because your user failed the Risk Check. This is a check that
looks for risky behavior such as a user trying to verify multiple identities
from the same device or the same IP address, something that commonly occurs when
you're testing Identity Verification.

If you want to allow this on a case-by-case basis, you can manually select the
failed Identity Verification attempt in the Plaid dashboard and then click
**Override Result** in the **Potential Risks** section. Click the "Verify my
Identity" button again in the browser and your Identity Verification session
will succeed.

If you want to allow this permanently, you can edit the template in the Plaid
dashboard:

- Head back to the Identity Verification section of the Plaid dashboard
- Select your template
- Click **Open Editor**
- In the Identity Verification editor, select the **Rulesets** section
- Select **Risk Rules**
- Change the Acceptable Risk Level of **Network Risk** from "Medium Risk" to
  "High Risk"
- Click **Publish Changes**

## 2. The Pre-fill flow

In some cases, you might already have information about your user that Identity
Verification will want, such as your user's full name, phone number, date of
birth, or mailing address. Rather than put your user through the trouble of
entering this information a second time, you can "kick-start" your user's
Identity Verification process by sending this information to Plaid before
starting the Identity Verification flow.

To try out the pre-fill flow, click on the **Pre-fill some data** button. We'll
simulate entering the name, date of birth, and mailing address for our test
user. Then click the **Verify my identity** button. You'll notice that when you
verify your user's identity this time, you'll have much fewer fields to fill
out.

Note that you have to add the user's information before starting the Identity
Verification flow. You can't add it once the process has begun.

### How it works

Again, make sure to view the code for the full details, but essentially:

1. The server makes a call to `/identity_verification/create` to initiate an
   Identity Verification session, adding in whatever information we already know
   about the user.
2. This call returns a Identity Verification session ID, which we store in our
   database.
3. Note that because of the way our application works, we already have a link
   token generated before we make a call to `/identity_verification/create`.
   This is fine -- there's no need to regenerate a new Link token.
4. When the client runs Link, Identity Verification will see that the `user_id`
   which was used to generate the Link token is the same as the `user_id` which
   was used to create a Identity Verification session, and it won't ask the user
   to enter information that it already received in step 1.
5. We then proceed with steps 3-6 in the Standard flow. The Identity
   Verification session ID received by Link and your webhooks will be the same
   value as what was already generated in step 2.

### Do I need to verify the information I send to Plaid?

It is not necessary for you to verify information like the user's name or
mailing address before sending it to Plaid -- that's what Identity Verification
is for (with the exception of the user's email address, which we recommend you
verify). However, it should be made clear when you collect this information from
the user that they should be sending you legitimate data that will be used for
identity verification purposes.

## 3. The Shareable URL flow

Typically, when your users complete the Identity Verification process, they'll
do so within your application using Link, Plaid's client-side widget that
handles all of the UI work for you. But you also have the option of generating a
URL that you can direct your users to in order to complete the process.

The most common scenario for using a shareable URL is when a company hasn't
integrated Identity Verification into their app, but needs to occasionally
verify a user's identity on an ad hoc basis. For example, a customer's account
might be flagged for suspicious activity and your customer service team will
want to verify their identity as an extra security step. This is typically done
through the Plaid dashboard:

- On the panel for the Identity Verification template you created, click the
  "Create Verification" button at the top
- Add the user's customer reference (like their internal application ID) and
  their email, if you have it.
  - If you want to use the ID of your currently signed in user, you can find
    their full ID by looking at the contents of the `get_basic_user_info` call
    in your browser.
- Click the "Create verification link" button
- Copy-and-paste that link, and share it with your customer

You should be able to see your customer's Identity Verification status, along
with the data they entered, in the appropriate section of the panel for the
Identity Verification template. ("In progress", "Passed", "Failed", etc.)

## 3a. The Generated Shareable URL flow

It's less common to use a shareable URL within your application if you've
already integrated the Plaid API -- most applications would prefer that their
users stay within their application via the Link widget rather than switch to
another tab or another browser. But we've included this process here for
completeness.

To try generating a Shareable URL in the browser, click the **Generate a
Shareable URL** button. You will be given a URL to follow that opens up the
Identity Verification process in a new window.

When you're done (assuming you have webhooks working), your client page should
update after a few seconds to reflect your verified identity. If you don't have
webhooks working, you can click the **Simulate receiving a webhook** button to
complete the process.

### How it works

1. The server makes a call to `/identity_verification/create` to initiate a
   Identity Verification session, adding the `is_shareable: true` argument to
   indicate that we want to generate a URL that can be shared with the user.
2. This URL is then presented to the user, which they can open in a separate
   window and complete the process.
3. If you are using webhooks, your server will receive a `STATUS_UPDATED`
   webhook with the Identity Verification session ID.
4. The server can then make a call to `/identity_verification/get` with this
   session ID and it will update your user's entry in the database accordingly.
5. The client, meanwhile, is performing some simple polling to fetch this
   database entry every few seconds. You're free to build something more
   sophisticated in your app.
6. If you don't have webhooks working, the `/server/fake_webhook` endpoint on
   the server will pretend as though it has received a webhook for this user by
   looking up the most recent Identity Verification session ID that we have
   stored for this user. Then it will perform steps 4-5 with this session ID.

## 4. The Backend-Only flow

In some cases, your application may already have all of the information you need
to verify your user without any additional input from them. Alternately, you
might want to build a completely custom frontend without using Link. In these
situations, you can attempt to verify your user's identity completely on the
server.

For the backend-only flow to work, you'll need to make sure you're using an
Identity Verification template that is using the "Lightning Only" flow, and
doesn't require SMS verification.

To create a new template, follow the steps for creating an Identity Verification
template at the beginning of this readme, but with the following exceptions:

1. Be sure to _uncheck_ **Verify Phone Number with SMS** in the Setup panel
2. For the workflow, select **Lightning Only**

**Warning:** You should only skip verifying your user's phone number in Identity
Verification if your application is already performing this verification on its
own.

Copy the template ID for the template you just created, and paste that into your
.env file as the value for the `LIGHTNING_ONLY_NO_SMS_ID` entry. If you're
running `npm run watch`, the server should automatically restart.

You can then start the backend-only flow by checking the Terms of Service
checkbox, and then clicking the **Server-only verification** button. If you have
webhooks working, your application should update after a few seconds with your
newly identified user.

If you don't have webhooks working, you can click the **Simulate receiving a
webhook** button, and your application should update as well

Note that Identity Verification sessions created this way will not show up in
the "See all my IDV attempts" results, because that call is made using your
original Identity Verification template.

### How it works

1. The server makes a call to `/identity_verification/create` to initiate a
   Identity Verification session, sending across all of the data Plaid would
   need to verify the user's identity, including their name, address, phone
   number, and last 4 digits of their social security number.
   - We also include a `gave_consent: true` value to indicate that our user has
     consented to their data being shared with Plaid for verification purposes.
     (This is usually mentioned as part of your application's terms of service.
     Please consult with your legal counsel on the actual wording to use -- our
     law background consists of watching reruns of Judge Judy.)
   - For this sample application, this data is hard-coded to that of our sandbox
     user.
2. If you are using webhooks, your server will receive a `STATUS_UPDATED`
   webhook with the Identity Verification session ID.
3. The server then makes a call to `/identity_verification/get` with this
   session ID and it updates your user's entry in the database accordingly.
4. Like in the previous flow, the client is just performing some simple polling
   to re-fetch this database entry every few seconds.
5. If you don't have webhooks working, the `/server/fake_webhook` endpoint on
   the server will pretend as though it has received a webhook for this user by
   looking up the most recent Identity Verification session ID that we have
   stored for this user and then running steps 3-4.
