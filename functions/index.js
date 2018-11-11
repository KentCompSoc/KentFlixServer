const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const express = require("express");
const admin = require('firebase-admin');
const bodyParser = require("body-parser");
const crypto = require('crypto');
const requestPromise = require('request-promise');
const xml2js = require('xml2js-es6-promise');

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

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(re.test(email)){
    if(email.indexOf("@kent.ac.uk", email.length - "@kent.ac.uk".length) !== -1){
        return true;
    }
  }
  return false;
}

var sessionChecker = (req, res, next) => {
  if (req.params.sessionID) {
    const sessionRef = db.collection("sessions").doc(req.params.sessionID);
    sessionRef.get().then((doc) => {
      if (doc.exists) {
        next();
      } else res.status(403).send({
                "status" : 604,
                "message" : "Not a valid sessionID",
                "error" : "Unauthorized"
              });
    }).catch(() => {
      res.status(500).send({
                "status" : 1,
                "message" : "Failed to verify user with sessionID",
                "error" : "Unexpected error"
              });
    });
  } else {
    res.status(400).send({
                "status" : 215,
                "message" : "No sessionID has been parsed",
                "error" : "No token was specified"
              });
  } 
};

var sendSuccess = (res, payload) => {
  const responce = {
    "success": true,
    "payload": payload
  };
  return res.status(200).send(JSON.stringify(responce));
};

var sendError = (res, code, message) => {
  const responce = {
    "success": false,
    "error": {
      "code": code,
      "message": message
    }
  };
  return res.status(code).send(JSON.stringify(responce));
};

/*var processFeed = (res, db, json, courseID, year) => {
  const json = json.rss.channel;
  
  if (courseID != courseRaw.title[0].match(/([A-Z,a-z]+[0-9]+)/)[0]){
    return sendError(res, 500, "Course ID in url doesnt match JSON")
  }
  
  let yearStr = courseRaw.title[0].match(/(20[0-2][0-9]\/20[0-2][0-9])/)[0];;
  const year = yearStr.substr(0, yearStr.indexOf("/") - 1);
  if (year > new Date().getYear() + 1)
    return sendError(res, 500, "Not reached that year yet");
  if (year < new Date().getYear() - 1)
    return sendError(res, 500, "We don't store lectures that far in the past");
  
  const courseYearRef = db.collection("courses").doc(courseID).collection("years").doc(year);
  
  
  
  function roundMinutes(date) {
    date.setHours(date.getHours() + Math.round(date.getMinutes()/60) - 1);
    date.setMinutes(0);
    return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
  }
  
  var batch = db.batch();
  
  for (var lectureID in courseRaw.item) {
    const lecture = courseRaw.item;
    let title = lecture.title.replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)+(.*)+(AM|PM|am|pm)/, '');
    if (title.length == 0)
      title = courseRaw.title + " " + new Date(lecture.pubDate).toDateString() + " " + roundMinutes(new Date(lecture.pubDate));
    const lectureObj = {
      title: title,
      author: lecture["itunes:author"].replace("Moodle/", "").replace("Moodle", ""),
      videoURL: lecture["enclosure"]["-url"],
      videoLength: lecture["itunes:duration"],
      duration: parseInt(lecture["itunes:duration"] / 60) + ":"+ ("0" + parseInt(lecture["itunes:duration"] % 60)).slice(-2),
      date: new Date(lecture.pubDate).toDateString() + " " + roundMinutes(new Date(lecture.pubDate)),
    };
    lectureObj.id = lectureID;
    lectures.push(lectureObj);
  }
  const courseYearRef = db.collection("courses").doc(courseID).collection("years").doc(year);
  batch.update(courseYearRef, {
    lectures: lectures;
  })
  batch.commit().then(function () {
    return sendSuccess(res, lectures);
  });
}*/

var processJSON = (db, batch, json) => {
  let courseRaw = json.rss.channel[0];
  let yearStr = courseRaw.title[0].match(/(20[0-2][0-9]\/20[0-2][0-9])/)[0];
  const year = yearStr.substr(0, yearStr.indexOf("/"));
  const courseID = courseRaw.title[0].match(/[A-Z]+[0-9]+/)[0]
  
  function roundMinutes(date) {
    date.setHours(date.getHours() + Math.round(date.getMinutes()/60) - 1);
    date.setMinutes(0);
    return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
  }
  lectures = [];
  for (var lectureID in courseRaw.item) {
    const lecture = courseRaw.item[lectureID];
    let title = lecture.title[0].replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)+(.*)+(AM|PM|am|pm)/, '');
    if (title.length == 0)
      title = courseRaw.title[0] + " " + new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0]));
    const lectureObj = {
      title: title,
      author: lecture["itunes:author"][0].replace("Moodle/", "").replace("Moodle", ""),
      videoURL: lecture["enclosure"][0]["$"]["url"],
      videoLength: lecture["itunes:duration"][0],
      duration: parseInt(lecture["itunes:duration"][0] / 60) + ":"+ ("0" + parseInt(lecture["itunes:duration"][0] % 60)).slice(-2),
      date: new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0])),
    };
    lectureObj.id = lectureID;
    lectures.push(lectureObj);
  }
  const courseYearRef = db.collection("courses").doc(courseID).collection("years").doc(year);
  batch.update(courseYearRef, {
    lectures: lectures
  });
}

app.post('/login', (req, res) => {  
  const values = req.body;
  if (!validateEmail(values.email)) {
    return sendError(res, 205, "Please use a valid email");
  } else if (!values.password) {
    return sendError(res, 205, "Please use a valid password");
  } else {
    var userRef = db.collection("users").doc(values.email);
    userRef.get().then(doc => {
      if (!doc.exists) {
        return sendError(res, 206, "No user with that email");
      } else {
        const data = doc.data();
        if (!data.verified) {
          return sendError(res, 221, "You have not verified, check your email");
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
              return sendError(res, 500, "Failed to create a session");
            });
          } else {
            return sendError(res, 205, "Invalid password");
          }
        }
      }
    }).catch(a =>{
      return sendError(res, 500, "Failed to log user in");
    });
  }
});

app.post('/signup', (req, res) => {
  const values = req.body;
  if (!validateEmail(values.email)) { //verify email
    res.status(205).send("Please use a valid email");
  } else if (!values.password) { //verify password
    res.status(205).send("Please use a valid password");
  } else {
    const userRef = db.collection("users").doc(values.email);
    userRef.get()
      .then((docSnapshot) => {
        if (docSnapshot.exists) {
           res.status(211).send("This email has already been used");
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
              res.status(500).send("Failed to create user");
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
  const schoolRef = db.collection("schools");
  schoolRef.get()
    .then(function(querySnapshot) {
      var returnArr = [];
      querySnapshot.forEach(function(doc) {
          returnArr.push(doc.data());
      });
      return returnArr;
    }).then(function(schools) {
      return sendSuccess(res, schools);
    }).catch(error =>{
      return sendError(res, 400, "Failed to get schools");
    });
});

app.post('/:sessionID/schools/add', sessionChecker, (req, res) => {
  const values = req.body;
  const schoolID = values.schoolID;
  const schoolName = values.schoolName;
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

app.post('/:sessionID/courseHashs/add', sessionChecker, (req, res) => {
  const values = req.body;
  const hash = values.hash;
  const schoolID = values.schoolID;
  const courseID = values.courseID;
  const year = values.year;
  let result = {
    error: false,
  }
  const keyRef = db.collection("courseKeys").doc();
  keyRef.set({
    hash: hash,
    schoolID: schoolID,
    courseID: courseID,
    year: year
  }).then(function() {
    result.infoMessage = "Created the Course Hash";
    res.send(JSON.stringify(result));
  }).catch(a =>{
    result.error = true;
    result.infoMessage = "Failed to process the Course Hash";
    res.send(JSON.stringify(result));
  });
});

app.get('/:sessionID/schools/:schoolID/courses', sessionChecker, (req, res) => {  
  const schoolID = req.params.schoolID;
  const coursesRef = db.collection("courses").where("schoolID", "==", schoolID);
  coursesRef.get()
    .then(function(querySnapshot) {
        let courses = [];
        querySnapshot.forEach(function(doc) {
            courses.push(doc.data());
        });
        return courses;
    }).then(courses => {
        return sendSuccess(res, courses);
    }).catch(a =>{
      return sendError(res, 400, "Failed to get courses");
    });
});

app.get('/:sessionID/courses/:courseID', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const coursesRef = db.collection("courses").doc(courseID);
  coursesRef.get()
    .then(doc => {
      return sendSuccess(res, doc.data());
    }).catch(a =>{
      return sendError(res, 400, "Failed to get course in this year");
    });
});

app.get('/:sessionID/courses/:courseID/:year', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const year = req.params.year;
  const coursesRef = db.collection("courses").doc(courseID).collection("years").doc(year);
  coursesRef.get()
    .then(doc => {
      return sendSuccess(res, doc.data());
    }).catch(a =>{
      return sendError(res, 400, "Failed to get course in this year");
    });
});

app.get('/:sessionID/courses/:courseID/:year/lectures', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const year = req.params.year;
  const coursesRef = db.collection("courses").doc(courseID).collection("years").doc(year).collection("lectures");
  coursesRef.get()
    .then(function(querySnapshot) {
        let courses = [];
        querySnapshot.forEach(function(doc) {
            courses.push(doc.data());
        });
        return courses;
    }).then(courses => {
      return sendSuccess(res, courses);
    }).catch(a =>{
      return sendError(res, 400, "Failed to get lectures");
    });
});

app.get('/:sessionID/lectures/:lectureID', sessionChecker, (req, res) => {  
  const lectureID = req.params.lectureID;
  const coursesRef = db.collection("lectures").doc(lectureID);
  coursesRef.get()
    .then(function(doc) {
        return doc.data();
    }).then(courses => {
      return sendSuccess(res, courses);
    }).catch(a =>{
      return sendError(res, 400, "Failed to get lectures");
    });
});

// TODO: Test
app.get('/:sessionID/courses/:courseID/:year/:lectureID/progress/:time', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const year = req.params.year;
  const lectureID = req.params.lectureID;
  const time = req.params.time;
  const content = req.body;
  return processFeed(res, db, content, courseID, year);
});

app.get('/:sessionID/courses/:courseID/:year/lectures', sessionChecker, (req, res) => {  
  const courseID = req.params.courseID;
  const year = req.params.year;
  const coursesRef = db.collection("courses").doc(courseID).collection("years").doc(year).collection("lectures");
  coursesRef.get()
    .then(function(querySnapshot) {
        let courses = [];
        querySnapshot.forEach(function(doc) {
            courses.push(doc.data());
        });
        return courses;
    }).then(courses => {
      return sendSuccess(res, courses);
    }).catch(a =>{
      return sendError(res, 400, "Failed to get lectures");
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

exports.createLecture = functions.firestore.document('lectures/{lectureID}').onCreate((snap, context) => {
  const newValue = snap.data();
  const lecturesRef = db.collection("courses").doc(newValue.courseID).collection("years").doc(newValue.year); 
  lecturesObj = {};
  lecturesObj["lectures."+newValue.lectureID] = {
    title: newValue.title,
    author: newValue.author,
    videoURL: newValue.videoURL,
    videoLength: newValue.videoLength,
    duration: newValue.duration,
    date: newValue.date,
  };
  return lecturesRef.update(lecturesObj);
});

exports.updateLecture = functions.firestore.document('lectures/{lectureID}').onUpdate((change, context) => {
  const newValue = change.after.data();
  const lecturesRef = db.collection("courses").doc(newValue.courseID).collection("years").doc(newValue.year); 
  lecturesObj = {};
  lecturesObj["lectures."+newValue.lectureID] = {
    title: newValue.title,
    author: newValue.author,
    videoURL: newValue.videoURL,
    videoLength: newValue.videoLength,
    duration: newValue.duration,
    date: newValue.date,
  };
  return lecturesRef.update(lecturesObj);
});


exports.deleteLecture = functions.firestore.document('lectures/{lectureID}').onDelete((snap, context) => {
  const oldValue = snap.data();
  const lecturesRef = db.collection("courses").doc(newValue.courseID).collection("years").doc(newValue.year); 
  lecturesObj = {};
  lecturesObj["lectures."+newValue.lectureID] = FieldValue.delete();
  return lecturesRef.update(lecturesObj)
});

exports.createLectureHash = functions.firestore.document('courseKeys/{courseKeyID}').onCreate((snap, context) => {
  const newValue = snap.data();
  const batch = db.batch();
  const lecturesRef = db.collection("courses").doc(newValue.courseCode);
  batch.set(lecturesRef, {
    courseID: newValue.courseCode,
    name: newValue.name,
    schoolID: newValue.school,
    term: newValue.period,
    status: "active",
  });
  
  const yearRef = db.collection("courses").doc(newValue.courseCode).collection("years").doc(newValue.year); 
  batch.set(yearRef, {
    courseID: newValue.courseCode,
    name: newValue.name,
    schoolID: newValue.school,
    term: newValue.period,
    lectures: {},
    status: "active",
  });
  return batch.commit();
});

exports.updateLectureHash = functions.firestore.document('courseKeys/{courseKeyID}').onUpdate((change, context) => {
  const newValue = change.after.data();
  const batch = db.batch();
  const lecturesRef = db.collection("courses").doc(newValue.courseCode);
  batch.update(lecturesRef, {
    courseID: newValue.courseCode,
    name: newValue.name,
    schoolID: newValue.school,
    term: newValue.period,
  });
  
  const yearRef = db.collection("courses").doc(newValue.courseCode).collection("years").doc(newValue.year); 
  batch.set(yearRef, {
    courseID: newValue.courseCode,
    name: newValue.name,
    schoolID: newValue.school,
    term: newValue.period,
  });
  return batch.commit();
});

exports.createLectureHash = functions.firestore.document('courseKeys/{courseKeyID}').onDelete((snap, context) => {
  const newValue = snap.data();
  const batch = db.batch();
  const lecturesRef = db.collection("courses").doc(newValue.courseCode);
  batch.update(lecturesRef, {
    status: "inactive",
  });
  
  const yearRef = db.collection("courses").doc(newValue.courseCode).collection("years").doc(newValue.year); 
  batch.update(yearRef, {
    status: "inactive",
  });
  return batch.commit();
});

function addDays(days) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  return result;
}

exports.hourly_job = functions.pubsub
  .topic('hourly-tick')
  .onPublish((message) => {
    const hour = new Date().getHours();
    if (hour > 8 && hour < 18) {
      var yearDate = new Date();
      yearDate.setDate(yearDate.getDate() + 100);
      const currentYear = yearDate.getFullYear() - 1;
      const coursesToUpdateRef = db.collection("courseKeys").where('year', '==', currentYear).where('nextUpdate', '<', new Date());
      return coursesToUpdateRef.get()
        .then(function(querySnapshot) {
          querySnapshot.forEach(function(doc) {
            const course = doc.data();          
            var options = {
              method: 'GET',
              uri: 'https://cors-anywhere.herokuapp.com/http://player.kent.ac.uk/Panopto/Podcast/Podcast.ashx?courseid=' + course.hash + '&type=mp4',
              headers: {
                  'x-requested-with': 'https://player.kent.ac.uk',
              }
            };

            return requestPromise(options)
              .then(function (xml) {
                return xml2js(xml).then(function(json) {
                  const batch = db.batch();
                  let courseRaw = json.rss.channel[0];
                  let yearStr = courseRaw.title[0].match(/(20[0-2][0-9]\/20[0-2][0-9])/)[0];
                  const year = yearStr.substr(0, yearStr.indexOf("/"));
                  const courseID = courseRaw.title[0].match(/[A-Z]+[0-9]+/)[0]

                  function roundMinutes(date) {
                    date.setHours(date.getHours() + Math.round(date.getMinutes()/60) - 1);
                    date.setMinutes(0);
                    return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
                  }
                  lectures = [];
                  for (var lectureID in courseRaw.item) {
                    const lecture = courseRaw.item[lectureID];
                    let title = lecture.title[0].replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)+(.*)+(AM|PM|am|pm)/, '');
                    if (title.length == 0)
                      title = courseRaw.title[0] + " " + new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0]));
                    const lectureObj = {
                      title: title,
                      author: lecture["itunes:author"][0].replace("Moodle/", "").replace("Moodle", "").replace(`\\`, ""),
                      videoURL: lecture["enclosure"][0]["$"]["url"],
                      videoLength: lecture["itunes:duration"][0],
                      duration: parseInt(lecture["itunes:duration"][0] / 60) + ":"+ ("0" + parseInt(lecture["itunes:duration"][0] % 60)).slice(-2),
                      date: new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0])),
                    };
                    lectureObj.id = lectureID;
                    lectures.push(lectureObj);
                    lectureRef = db.collection("lectures").doc(courseID+"."+year+"."+lectureID);
                    batch.set(lectureRef, lectureObj);
                  }
                  let courseRef = db.collection("courses").doc(courseID);
                  batch.set(courseRef, {
                    courseID: courseID,
                    name: course.name,
                    period: course.period,
                    schoolID: course.school,
                  });
                  return batch.commit();
                });
              })
              .catch(function (err) {
                  return console.warn("Could not update CourseHash - " + course.hash + " "+ err);
              });
            });
      });
    }
  return true;
  });
