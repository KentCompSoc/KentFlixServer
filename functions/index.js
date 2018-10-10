const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const express = require("express");
const admin = require('firebase-admin');
const bodyParser = require("body-parser");
const crypto = require('crypto');

const app1 = express();
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const app = express();
const main = express();
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

main.use('/api/v1', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/me', (req, res) => {
  result.error = true;
  result.infoMessage = "Are you signed in?";
  res.send(JSON.stringify(result));
});

app.post('/login', (req, res) => {  
  const values = req.body;
  let result = {
    error: false,
  }
  if (!values.email) { //verify email
    result.error = true;
    result.infoMessage = "Please use a valid email";
    res.send(JSON.stringify(result));
  } else if (!values.password) { //verify password
    result.error = true;
    result.infoMessage = "Please use a valid password";
    res.send(JSON.stringify(result));
  } else {
    var userRef = db.collection("users").doc(values.email);
    userRef.get().then(doc => {
      const data = doc.data();
      const hash = crypto.pbkdf2Sync(values.password, data.salt, 10000, 512, 'sha512').toString('hex');
      if (data.hash === hash) {
        var sessionID = crypto.createHash('sha256').update("COMPSOC-KENTFLIX-" + data.email).digest('base64');
        result.infoMessage = "User now signed in";
        result.result = {
          sessionID: sessionID,
        }
        res.send(JSON.stringify(result));
      } else {
        result.error = true;
        result.infoMessage = "Invalid Password";
        res.send(JSON.stringify(result));
      }
    }).catch(a =>{
      result.error = true;
      result.infoMessage = "Failed to login user";
      res.send(JSON.stringify(result));
    });
  }
});

app.get('/verify/:email/:tokenID', (req, res) => {
  const email = req.params.email;
  const tokenID = req.params.tokenID;
  
  const userRef = db.collection("users").doc(email);
    
  userRef.get()
    .then((doc) => {
      if (doc.exists) {
        const user = doc.data();
        if (user.verified){
          res.send("You have already been verified");
        } else if (user.token == tokenID) {
          userRef.update({
            verified: true
          })
            .then(function() {
              res.send("User has been verified, you can now log into the app");
            })
            .catch(function(error) {
              res.send("Failed to verify this user");
            });
        } else {
          res.send("Incorrect Token");
        }
      }
    }).catch(function(error) {
      res.send("Failed to find a new user by that email");
    });
});

app.post('/signup', (req, res) => {
  const values = req.body;
  let result = {
    error: false,
  }
  if (!values.email) { //verify email
    result.error = true;
    result.infoMessage = "Please use a valid email";   res.send(JSON.stringify(result));
  } else if (!values.password) { //verify password
    result.error = true;
    result.infoMessage = "Please use a valid password";
    res.send(JSON.stringify(result));
  } else {
    const userRef = db.collection("users").doc(values.email);
    
    userRef.get()
      .then((docSnapshot) => {
        if (docSnapshot.exists) {
          result.infoMessage = "This email has already been used";
          res.send(JSON.stringify(result));
        } else {

          const salt = crypto.randomBytes(16).toString('hex');
          const hash = crypto.pbkdf2Sync(values.password, salt, 10000, 512, 'sha512').toString('hex');
          const userObj = {
            email: values.email,
            hash: hash,
            salt: salt,
          };
          userRef.set(userObj)
            .then(function() {
              result.infoMessage = "User has been created";
              res.send(JSON.stringify(result));
            })
            .catch(function(error) {
              result.infoMessage = "Failed to create user";
              res.send(JSON.stringify(result));
            });
        }
    });
  }
});

main.use('/api/v1', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
// webApi is your functions name, and you will pass main as 
// a parameter
exports.webApi = functions.https.onRequest(main);


exports.createUser = functions.firestore.document('users/{userID}').onCreate((snap, context) => {
  const userID = context.params.userID;
  const newValue = snap.data();
  const email = newValue.email;
  const token = crypto.createHash('md5').update(email).digest('hex');
  
  const userRef = db.collection("users").doc(userID); 
  return userRef.set({
    verified: false,
    token: token,
  }, {merge: true}).then(a => {
     const APP_NAME = 'KentFlix';
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: email,
  };

  // The user subscribed to the newsletter.
  mailOptions.subject = `Welcome to ${APP_NAME}!`;
  mailOptions.html = `Hey! Welcome to ${APP_NAME}.

In order to verify your a Kent Student please visit <a href="https://kentflix-7f510.firebaseapp.com/api/v1/verify/${email}/${token}">Here</a> to use our app

I hope you will enjoy our service.`;
    return mailTransport.sendMail(mailOptions).then(() => {
      return console.log('New welcome email sent to:', email);
    });
  });
});

/*

app.post('/contacts', (req, res) => {
    firebaseHelper.firestore
        .createNewDocument(db, contactsCollection, req.body);
    res.send('Create a new contact');
})
// Update new contact
app.patch('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .updateDocument(db, contactsCollection, req.params.contactId, req.body);
    res.send('Update a new contact');
})
// View a contact
app.get('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .getDocument(db, contactsCollection, req.params.contactId)
        .then(doc => result.status(200).send(doc));
})
// View all contacts
app.get('/contacts', (req, res) => {
    firebaseHelper.firestore
        .backup(db, contactsCollection)
        .then(data => result.status(200).send(data))
})
// Delete a contact 
app.delete('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .deleteDocument(db, contactsCollection, req.params.contactId);
    res.send('Document deleted');
})

exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  const email = user.email;
  const displayName = user.displayName;
  return sendWelcomeEmail(email, displayName);
});

exports.sendByeEmail = functions.auth.user().onDelete((user) => {
// [END onDeleteTrigger]
  const email = user.email;
  const displayName = user.displayName;

  return sendGoodbyeEmail(email, displayName);
});

// Sends a welcome email to the given user.
function sendWelcomeEmail(email, displayName) {
  const APP_NAME = 'KentFlix';
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: email,
  };

  // The user subscribed to the newsletter.
  mailOptions.subject = `Welcome to ${APP_NAME}!`;
  mailOptions.text = `Hey ${displayName || ''}! Welcome to ${APP_NAME}. I hope you will enjoy our service.`;
  return mailTransport.sendMail(mailOptions).then(() => {
    return console.log('New welcome email sent to:', email);
  });
}

function sendGoodbyeEmail(email, displayName) {
  const APP_NAME = 'KentFlix';
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: email,
  };

  // The user unsubscribed to the newsletter.
  mailOptions.subject = `Bye!`;
  mailOptions.text = `Hey ${displayName || ''}!, We confirm that we have deleted your ${APP_NAME} account.`;
  return mailTransport.sendMail(mailOptions).then(() => {
    return console.log('Account deletion confirmation email sent to:', email);
  });
}

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
*/