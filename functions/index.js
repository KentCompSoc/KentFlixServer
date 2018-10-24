const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const express = require("express");
const admin = require('firebase-admin');
const bodyParser = require("body-parser");
const crypto = require('crypto');
const request = require('request');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const settings = {timestampsInSnapshots: true};
db.settings(settings);
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

var sessionChecker = (req, res, next) => {
  if (req.params.sessionID) {
    const sessionRef = db.collection("sessions").doc(req.params.sessionID);
    sessionRef.get().then((doc) => {
      if (doc.exists) {
        next();
      } else res.status(400).send("Not a valid sessionID");
    }).catch(() => {
      res.status(400).send("Failed to verify user with sessionID");
    });
  } else {
    res.status(400).send("Hasn't parsed sessionID");
  } 
};

app.post('/login', (req, res) => {  
  const values = req.body;
  let result = {};
  if (!values.email) { //verify email
    res.status(400).send("Please use a valid email");
  } else if (!values.password) { //verify password
    res.status(400).send("Please use a valid password");
  } else {
    var userRef = db.collection("users").doc(values.email);
    userRef.get().then(doc => {
      if (!doc.exists) {
        res.status(400).send("No user with that email");
      } else {
        const data = doc.data();
        if (!data.verified) {
          res.status(400).send("You have not verified, check your email");
        } else {
          const hash = crypto.pbkdf2Sync(values.password, data.salt, 10000, 512, 'sha512').toString('hex');
          if (data.hash === hash) {
            const sessionRef = db.collection("sessions").doc();
            sessionRef.set({
              userID: doc.id,
            }).then(() => {
              result.infoMessage = "User now logged in";
              result.sessionID = sessionRef.id;
              res.status(200).send(JSON.stringify(result));
            }).catch(a =>{
              result.infoMessage = "Failed to create a session";
              res.status(400).send(JSON.stringify(result));
            });
          } else {
            res.status(400).send("Invalid password");
          }
        }
      }
    }).catch(a =>{
      res.status(400).send("Failed to log user in");
    });
  }
});

app.post('/signup', (req, res) => {
  const values = req.body;
  if (!values.email && values.email.match(/^([a-zA-Z0-9]*)@kent.ac.uk$/)) { //verify email
    res.status(400).send("Please use a valid email");
  } else if (!values.password) { //verify password
    res.status(400).send("Please use a valid password");
  } else {
    const userRef = db.collection("users").doc(values.email);
    userRef.get()
      .then((docSnapshot) => {
        if (docSnapshot.exists) {
           res.status(400).send("This email has already been used");
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
              res.status(200).send("Verify you account by checking your emails");
            })
            .catch(function(error) {
              res.status(400).send("Failed to create user");
            });
        }
    });
  }
});

app.get('/verify/:email/:tokenID', (req, res) => {
  const email = req.params.email;
  const tokenID = req.params.tokenID;
  
  const userRef = db.collection("users").doc(email);
    
  userRef.get().then((doc) => {
    if (doc.exists) {
      const user = doc.data();
      if (user.verified){
        res.send("You have already been verified");
      } else if (user.token == tokenID) {
        userRef.update({
          verified: true
        }).then(function() {
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

app.get('/:sessionID', sessionChecker, (req, res) => {
  res.send(JSON.stringify(req.sessionID));
});

app.post('/:sessionID/feed/:courseID/update', sessionChecker, (req, res) => {
  const courseID = req.params.courseID;
  const json = req.body;
  let result = {};
  if (err) {
    result.error = true;
    result.infoMessage = "Could not process XML";
    res.send(JSON.stringify(result));
  } else {
    json = json.rss.channel[0];
    function roundMinutes(date) {
      date.setHours(date.getHours() + Math.round(date.getMinutes()/60) - 1);
      date.setMinutes(0);
      return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
    }
    const courseRaw = json;
    if (courseID != courseRaw.title[0].match(/([A-Z,a-z]+[0-9]+)/)[0]){
      result.error = true;
      result.infoMessage = "Course ID in url doesnt match XML" + courseID + " " + courseRaw.title[0].match(/([A-Z,a-z]+[0-9]+)/)[0];
      res.send(JSON.stringify(result));
    }
    const course = {
      title: courseRaw.title[0],
      link: courseRaw.link[0],
    };

    var batch = db.batch();

    const lectures = [];
    for (let lecture of courseRaw.item) {
      let title = lecture.title[0].replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)+(.*)+(AM|PM|am|pm)/, '');
      if (title.length == 0)
        title = courseRaw.title + " " + new Date(lecture.pubDate).toDateString() + " " + roundMinutes(new Date(lecture.pubDate));
      const lectureObj = {
        title: title,
        author: lecture["itunes:author"][0].replace("Moodle", ""),
        videoURL: lecture["enclosure"][0]["$"]["url"],
        videoLength: lecture["itunes:duration"][0],
        duration: parseInt(lecture["itunes:duration"][0] / 60) + ":"+ ("0" + parseInt(lecture["itunes:duration"][0] % 60)).slice(-2),
        date: new Date(lecture.pubDate).toDateString() + " " + roundMinutes(new Date(lecture.pubDate)),
      };

      var lectureRef = db.collection("courses").doc(course.title.match(/([A-Z,a-z]+[0-9]+)/)[0]).collection("lectures").doc(lectureObj.date);
      batch.set(lectureRef, lectureObj);
      lectureObj.id = lectureObj.date;
      lectures.push(lectureObj);
    }
    course.lectures = lectures;
    var courseRef = db.collection("courses").doc(course.title.match(/([A-Z,a-z]+[0-9]+)/)[0]);
    batch.set(courseRef, course);
    batch.commit().then(function () {
      course.id = course.title.match(/([A-Z,a-z]+[0-9]+)/)[0];
      res.send(JSON.stringify(course));
    });
  }
});

app.get('/:sessionID/courses/:courseID/lectures/:lectureID', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const lectureID = req.params.lectureID;
  let result = {
    error: false,
  }
  const lectureRef = db.collection("courses").doc(courseID).collection("lectures").doc(lectureID);
  lectureRef.get()
    .then(function(doc) {
      if (doc.exists){
        result.result = doc.data();
        res.send(JSON.stringify(result));
      } else {
        result.error = true;
        result.infoMessage = "Lecture doesnt exists";
        res.send(JSON.stringify(result));
      }
    }).catch(a =>{
      result.error = true;
      result.infoMessage = "Failed to get the lecture";
      res.send(JSON.stringify(result));
    });
});

app.get('/:sessionID/schools', sessionChecker, (req, res) => {  
  let result = {
    error: false,
  }
  const schoolRef = db.collection("schools");
  schoolRef.get()
    .then(function(querySnapshot) {
      var returnArr = [];
      querySnapshot.forEach(function(doc) {
          returnArr.push(doc.data());
      });
      return returnArr;
    }).then(function(array) {
      result.result = array;
      res.send(JSON.stringify(result));
    }).catch(error =>{
      result.error = true;
      result.infoMessage = "Failed to get schools";
      result.techinal = error.message;
      res.status(400).send(JSON.stringify(result));
    });
});

app.post('/:sessionID/schools/add/:schoolID/:schoolName', sessionChecker, (req, res) => {
  const schoolID = req.params.schoolID;
  const schoolName = req.params.schoolName;
  let result = {
    error: false,
  }
  const schoolRef = db.collection("schools").doc(schoolID);
  schoolRef.set({
    id: schoolID,
    name: schoolName,
  }).then(function() {
    result.infoMessage = "Created school";
    res.send(JSON.stringify(result));
  }).catch(a =>{
    result.error = true;
    result.infoMessage = "Failed to create a school";
    res.send(JSON.stringify(result));
  });
});

app.get('/:sessionID/schools/:schoolID/courses', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const lectureID = req.params.lectureID;
  let result = {
    error: false,
  }

  result.error = true;
  result.infoMessage = "Not yet available";
  res.send(JSON.stringify(result));

  //TODO : 
  const lectureRef = db.collection("courses").doc(courseID).collection("lectures").doc(lectureID);
  lectureRef.get()
    .then(function(doc) {
      if (doc.exists){
        result.result = doc.data();
        res.send(JSON.stringify(result));
      } else {
        result.error = true;
        result.infoMessage = "Could not find courses exists";
        res.send(JSON.stringify(result));
      }
    }).catch(a =>{
      result.error = true;
      result.infoMessage = "Failed to get courses";
      res.send(JSON.stringify(result));
    });
});

app.get('/:sessionID/courseList/:schoolID/:courseID/:courseHash', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const courseHash = req.params.courseHash;
  let result = {
    error: false,
  }
  const lectureRef = db.collection("courses").doc(courseID).collection("lectures").doc(lectureID);
  lectureRef.get()
    .then(function(doc) {
      if (doc.exists){
        result.result = doc.data();
        res.send(JSON.stringify(result));
      } else {
        result.error = true;
        result.infoMessage = "Lecture doesnt exists";
        res.send(JSON.stringify(result));
      }
    }).catch(a =>{
      result.error = true;
      result.infoMessage = "Failed to get the course";
      res.send(JSON.stringify(result));
    });
});

app.get('/:sessionID/courses/:courseID', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  let result = {
    error: false,
  }
  const courseRef = db.collection("courses").doc(courseID);
  courseRef.get()
    .then(function(doc) {
      if (doc.exists){
        result.result = doc.data();
        res.send(JSON.stringify(result));
      } else {
        result.error = true;
        result.infoMessage = "Course doesnt exists";
        res.send(JSON.stringify(result));
      }
    }).catch(a =>{
      result.error = true;
      result.infoMessage = "Failed to get the course";
      res.send(JSON.stringify(result));
    });
});

main.use('/api/v1', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
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