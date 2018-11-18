const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const express = require("express");
const admin = require('firebase-admin');
const bodyParser = require("body-parser");
const crypto = require('crypto');
const requestPromise = require('request-promise');
const xml2js = require('xml2js-es6-promise');
const Sentry = require('@sentry/node');

admin.initializeApp(functions.config().firebase);
Sentry.init({ dsn: 'https://31176562c6ef489699d72f797c8f315f@sentry.io/1324602' });
const db = admin.firestore();
const settings = {timestampsInSnapshots: true};
db.settings(settings);
const app = express();
const main = express();
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const FieldValue = admin.firestore.FieldValue;
const gmailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

const outlookEmail = functions.config().outlook.email;
const outlookPassword = functions.config().outlook.password;

const outlookTransport = nodemailer.createTransport({
  host: 'smtp.office365.com', // Office 365 server
  port: 587,     // secure SMTP
  secure: false, // false for TLS - as a boolean not string - but the default is false so just remove this completely
  auth: {
      user: outlookEmail,
      pass: outlookPassword
  },
  tls: {
      ciphers: 'SSLv3'
  }
});

main.use('/api/v1', app);

main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


app.use(function(req, res, next) {
  console.log(req.url);
  next();
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());

function getCurrentYear() {
  let yearDate = new Date();
  yearDate.setDate(yearDate.getDate() + 100);
  return yearDate.getFullYear();
}

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(re.test(email)){
    if(email.indexOf("@kent.ac.uk") !== -1){
        return true;
    }
  }
  return false;
}

var sendSuccess = (res, payload) => {
  const responce = {
    "success": true,
    "payload": payload,
    "status": 200,
  };
  return res.status(200).send(JSON.stringify(responce));
};

var sendError = (res, code, message) => {
  const responce = {
    "success": false,
    "error": {
      "message": message
    },
    "status": code,
  };
  return res.status(code).send(JSON.stringify(responce));
};

var sessionChecker = (req, res, next) => {
  if (req.params.sessionID) {
    const sessionRef = db.collection("sessions").doc(req.params.sessionID);
    sessionRef.get().then((doc) => {
      if (doc.exists) {
        next();
      } else sendError(res, 403, "Not a valid sessionID");
    }).catch(() => {
      sendError(res, 500, "Failed to verify user with sessionID");
    });
  } else sendError(res, 400, "No sessionID has been parsed");
};

// AUTHENTICATION //

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
              return sendSuccess(res, {sessionID: sessionRef.id});
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
  
  if (!validateEmail(values.email)) {
    return sendError(res, 205, "Please use a valid email");
  } else if (!values.password) {
    return sendError(res, 205, "Please use a valid password");
  } else {
    const userRef = db.collection("users").doc(values.email);
    userRef.get()
      .then((docSnapshot) => {
        if (docSnapshot.exists) {
          return sendError(res, 211, "This email has already been used");
        } else {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = crypto.pbkdf2Sync(values.password, salt, 10000, 512, 'sha512').toString('hex');
          userRef.set({
            email: values.email,
            hash: hash,
            salt: salt,
          }).then(function() {
            return sendSuccess(res, "Now verify you account by checking your emails");
          })
          .catch(function(error) {
            return sendError(res, 500, "Failed to signup");
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
        return sendError(res, 211, "You have already been verified");
      } else if (user.token == tokenID) {
        userRef.update({
          verified: true
        }).then(function() {
          return sendSuccess(res, "User has been verified, you can now log into the app");
        })
        .catch(function(error) {
          return sendError(res, 205, "Failed to verify this user");
        });
      } else {
        return sendError(res, 205, "Incorrect Token");
      }
    }
  }).catch(function(error) {
    return sendError(res, 500, "Failed to find a new user by that email");
  });
});

// PROFILE //

app.get('/:sessionID/me', sessionChecker, (req, res) => {
  const sessionID = req.params.sessionID;
  return sendSuccess(res, {
    sessionID: sessionID
  });
});

// SCHOOLS //

app.get('/:sessionID/schools', sessionChecker, (req, res) => {
  const schoolsRef = db.collection("constant").doc("schools");
  
  return schoolsRef.get().then(function(doc) {
    const schools = doc.data();
    res.set('Cache-Control', 'public, max-age=900, s-maxage=1800');
    return sendSuccess(res, schools);
  }).catch(error =>{
    return sendError(res, 400, "Failed to get schools");
  });
});

app.post('/:sessionID/schools/add', sessionChecker, (req, res) => {
  const values = req.body;
  const schoolID = values.schoolID;
  const schoolName = values.schoolName;
  const schoolRef = db.collection("schools").doc(schoolID);
  
  return schoolRef.set({
    id: schoolID,
    name: schoolName,
  }).then(function() {
    return sendSuccess(res, "Created School");
  }).catch(a => {
    return sendError(res, 500, "Failed to create a school");
  });
});

app.get('/:sessionID/schools/:schoolID/courses', sessionChecker, (req, res) => {
  const schoolID = req.params.schoolID;
  const coursesRef = db.collection("schools").doc(schoolID).collection("constants").doc("courses");
  
  return coursesRef.get().then(function(doc) {
    res.set('Cache-Control', 'public, max-age=900, s-maxage=1800');
    if (!doc.exists || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "We do not have this school on our records");
    } else {
      return sendSuccess(res, doc.data());
    }
  }).catch(error =>{
    return sendError(res, 400, "Failed to get courses");
  });
});

app.post('/:sessionID/courses/add', sessionChecker, (req, res) => {
  const values = req.body;
  const courseID = values.courseID;
  const courseName = values.courseName;
  const schoolID = values.schoolID;
  const batch = db.batch();
  
  const courseRef = db.collection("courses").doc(courseID);
  batch.set(courseRef, {
    name: name,
    schoolID: schoolID,
  });
  
  const courseModulesRef = db.collection("courses").doc(courseID).collection("constants").doc("modules");
  batch.set(courseModulesRef, {
    modules: {},
  });
  
  return batch.commit().then(function() {
    return sendSuccess(res, "Course has been created");
  }).catch(a =>{
    return sendError(res, 400, "Failed to create a course");
  });
});

// Modules //

app.get('/:sessionID/courses/:courseID', sessionChecker, (req, res) => {
  const courseID = req.params.courseID;
  const moduleRef = db.collection("courses").doc(courseID);
  
  return moduleRef.get().then(function(doc) {
    if (!doc.exists || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "We do not have this course on our records");
    } else {
      return sendSuccess(res, doc.data());
    }
  }).catch(error =>{
    return sendError(res, 400, "Failed to get course");
  });
});

app.get('/:sessionID/courses/:courseID/modules', sessionChecker, (req, res) => {
  const courseID = req.params.courseID;
  const moduleRef = db.collection("courses").doc(courseID).collection("constants").doc("modules");
  
  return moduleRef.get().then(function(doc) {
    if (!doc.exists || !doc.data() || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "We do not any courses for this on our records");
    } else {
      return sendSuccess(res, doc.data());
    }
  }).catch(error =>{
    return sendError(res, 400, "Failed to get course");
  });
});

app.post('/:sessionID/modules/add', sessionChecker, (req, res) => {
  const values = req.body;
  const moduleCode = values.moduleCode;
  const moduleName = values.moduleName;
  const moduleCourseID = values.moduleCourseID;
  const moduleStage = values.moduleState;
  const moduleTerm = values.moduleTerm;
  const batch = db.batch();
  
  const modulesRef = db.collection("modules").doc(moduleCode);
  batch.set(modulesRef, {
    moduleID: moduleCode,
    name: moduleName,
    courses: [moduleCourseID],
    stage: moduleStage,
    term: moduleTerm,
  });
  
  const modulesYearRef = modulesRef.collection("years").doc(getCurrentYear().toString());
  batch.set(modulesYearRef, {
    moduleID: moduleCode,
    name: moduleName,
    stage: moduleStage,
    term: moduleTerm,
  });
    
  return batch.commit().then(function() {
    return sendSuccess(res, "Module has been created");
  }).catch(a =>{
    return sendError(res, 400, "Failed to create a module" + a);
  });
});

app.post('/:sessionID/modules/:moduleID/assignTo/:courseID', sessionChecker, (req, res) => {  
  const values = req.body;
  const moduleID = req.params.moduleID;
  const courseID = req.params.courseID;
  const moduleCourse = values.moduleCourse;
  const modulesRef = db.collection("modules").doc(moduleID);
  
  return modulesRef.update({
    courses: FieldValue.arrayUnion(courseID),
  }).then(function() {
    return sendSuccess(res, "Module has been assigned to course");
  }).catch(error => {
    return sendError(res, 400, "Failed to assign module to course");
  });
});

app.get('/:sessionID/modules/:moduleID', sessionChecker, (req, res) => {  
  const moduleID = req.params.moduleID;
  const moduleRef = db.collection("modules").doc(moduleID)
  
  return moduleRef.get().then(doc => {
    if (!doc.exists || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "We dont have this module on our system");
    } else {
      const data = doc.data();
      return sendSuccess(res, {
        term: data.term,
        name: data.name,
        stage: data.stage,
        moduleID: doc.id,
      });
    }
  }).catch(a =>{
    return sendError(res, 400, "Failed to get module");
  });
});

app.get('/:sessionID/modules/:moduleID/lectures', sessionChecker, (req, res) => {  
  const moduleID = req.params.moduleID;
  const moduleRef = db.collection("modules").doc(moduleID).collection("years").doc(getCurrentYear().toString());
  
  return moduleRef.get().then(doc => {
    if (!doc.exists || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "Module hasn't been updated for "+getCurrentYear().toString());
    } else {
      return sendSuccess(res, doc.data());
    }
  }).catch(a =>{
    return sendError(res, 400, "Failed to get module");
  });
});

app.get('/:sessionID/modules/:moduleID/lectures/:year', sessionChecker, (req, res) => {  
  const moduleID = req.params.moduleID;
  const year = req.params.year;
  const moduleRef = db.collection("modules").doc(moduleID).collection("years").doc(year);
  
  return moduleRef.get().then(doc => {
     if (!doc.exists || doc.data() == null || doc.data() == {}) {
      return sendError(res, 400, "Module hasn't been updated for "+year);
    } else {
      return sendSuccess(res, doc.data());
    }
    return sendSuccess(res, doc.data());
  }).catch(a =>{
    return sendError(res, 400, "Failed to get module");
  });
});

// Lectures //

app.get('/:sessionID/lectures/:lectureID', sessionChecker, (req, res) => {  
  const lectureID = req.params.lectureID;
  const lectureRef = db.collection("lectures").doc(lectureID);
  
  return lectureRef.get().then(doc => {
    res.set('Cache-Control', 'public, max-age=900, s-maxage=1800');
    if (doc.exists) {
      return sendSuccess(res, doc.data());
    } else {
      return sendError(res, 400, "We dont have this lecture in the system");
    }
  }).catch(a =>{
    return sendError(res, 400, "Failed to get lecture");
  });
});

app.get('/:sessionID/lectures/:lectureID/updateProgress', sessionChecker, (req, res) => {  
  const lectureID = req.params.lectureID;
  const time = req.body.time;
  const progressRef = db.collection("userProgress").doc(userID);
  
  return progressRef.update({
    [lectureID]: time
  }).then(a => {
    return sendSuccess(res, {});
  }).catch(a =>{
    return sendError(res, 400, "Failed to get lecture");
  });
});







app.post('/:sessionID/moduleHashs/add', sessionChecker, (req, res) => {
  const values = req.body;
  const hash = values.hash;
  const schoolID = values.schoolID;
  const courseID = values.courseID;
  const stage = values.stage;
  const term = values.term;
  const year = values.year;
  const name = values.name;
  let result = {
    error: false,
  }
  const keyRef = db.collection("moduleKeys").doc();
  keyRef.set({
    hash: hash,
    schoolID: schoolID,
    courseID: courseID,
    year: year,
    nextUpdate: 0,
    stage: stage,
    term: term,
    name: name,
  }).then(function() {
    result.infoMessage = "Created the Course Hash";
    res.send(JSON.stringify(result));
  }).catch(a =>{
    result.error = true;
    result.infoMessage = "Failed to process the Course Hash";
    res.send(JSON.stringify(result));
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
    return outlookTransport.sendMail(mailOptions).then(() => {
      return console.log('New welcome email sent to:', email);
    });
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
    return gmailTransport.sendMail(mailOptions).then(() => {
      return console.log('New welcome email sent to:', email);
    });
  });
});


exports.createLectureHash = functions.firestore.document('moduleKeys/{courseKeyID}').onCreate((snap, context) => {
  const newValue = snap.data();
  const batch = db.batch();
  const courseRef = db.collection("courses").doc(newValue.courseCode);
  batch.set(courseRef, {
    courseID: newValue.courseCode,
    name: newValue.name,
    schoolID: newValue.school,
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

exports.updateCourseWhenAddedModule = functions.firestore.document('modules/{moduleID}').onUpdate((change, context) => {
  const newValue = change.after.data();
  const previousValue = change.before.data();
  const batch = db.batch();
  console.log("NV:"+JSON.stringify(newValue));
  console.log("PV:"+JSON.stringify(previousValue));
  if (newValue.courses != previousValue.courses) {
    const allCourses = newValue.courses.concat(previousValue.courses);
    let newContains, oldContains;
    
    const moduleObj = {
      moduleID: previousValue.moduleID,
      name: previousValue.name,
      stage: previousValue.stage,
      term: previousValue.term,
    };
    
    for (let courseID of allCourses) {
      newContains = newValue.courses.indexOf(courseID) > -1;
      oldContains = previousValue.courses.indexOf(courseID) > -1;
      let courseModulesRef = db.collection("courses").doc(courseID).collection("constants").doc("modules");
      
      if (newContains) {
        console.log("newContains:"+JSON.stringify({
          [newValue.moduleID]: moduleObj,
        }));
        batch.set(courseModulesRef, {
          [newValue.moduleID]: moduleObj,
        }, {merge: true});
      } else if (oldContains) {
        console.log("newContains:"+JSON.stringify({
          [newValue.moduleID]: null,
        }));
        batch.update(courseModulesRef, {
          [newValue.moduleID]: FieldValue.delete(),
        });
      }
    }
    
    return batch.commit();
  }
  return true;
});

function addDays(days) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  return result;
}

function getWeekNo(date) {
  return Math.floor((((date).getTime()/(86400000)) - 3) / 7);
}

function getDayNo(date) {
  return Math.floor((((date).getTime()/(86400000)) - 3) % 7);
}

function getHourNo(date) {
  return Math.floor((date.getTime() / 3600000)) % 24;
}

function getAchedemicYear() {
  const yearDate = new Date();
  yearDate.setDate(yearDate.getDate() + 100);
  return yearDate.getFullYear();
}

function getCurrentWeekNo() {
  return getWeekNo(new Date())
}

function getCurrentDayNo() {
  return getDayNo(new Date())
}

exports.weekly_job = functions.pubsub.topic('weekly-tick').onPublish((message) => {
  var options = {
    method: 'GET',
    uri: 'https://cors-anywhere.herokuapp.com/https://www.kent.ac.uk/student/my-study/app/data/weekDates.json',
    headers: {
        'x-requested-with': 'https://player.kent.ac.uk',
    },
  };

  return requestPromise(options).then(function (jsonStr) {
    const weeks = JSON.parse(jsonStr).response.weekDates.week;
    let weekObj = {};
    for (let week of weeks) {
      let code = week.week_beginning;
      let string = "";
      let state = "";
      if (code == "0") {
        code = "Fr";
        string = "Freshers";
        state = "F";
      } else if (code.indexOf("S") == -1 && code.indexOf("C") == -1 && code.indexOf("E") == -1) {
        code = "W"+code;
        string = "Week "+code.substr(1);
        state = "W";
      }
      if (code.indexOf("S") != -1) {
        string = "Summer Break " + code.substr(1);
        state = "S";
      } else if (code.indexOf("C") != -1) {
        string = "Christmas Break " + code.substr(1);
        state = "C";
      } else if (code.indexOf("E") != -1) {
        string = "Easter Break " + code.substr(1);
        state = "E"
      }
      const weekNo = getWeekNo(new Date(week.week_beginning_date.replace(":00:000", " ")));
      weekObj[weekNo] = {
        year: week.session_code,
        code: code,
        string: string,
        state: state,
      };
    }
    
    const weekRef = db.collection("constant").doc("weeks");
    return weekRef.update(weekObj);
  });
                                        
});

function startOfLectureDate(date) {
    date.setHours(date.getHours() - 1);
    date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
    date.setMinutes(0);
    let milli = 0;
    milli += ((date.getDay() + 6) % 7) * (1000 * 60 * 60 * 24);
    milli += (date.getHours()) * (1000 * 60 * 60);
    let hour = milli / (1000 * 60 * 60);
    return hour;
}

function roundMinutes(date) {
    date.setHours(date.getHours() + Math.round(date.getMinutes() / 60) - 1);
    date.setMinutes(0);
    return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
}

function numToSSColumn(num){
  var s = '', t;

  while (num > 0) {
    t = (num - 1) % 26;
    s = String.fromCharCode(65 + t) + s;
    num = (num - t)/26 | 0;
  }
  return s.toLowerCase() || "";
}

function getNextDayTime(dayNo, hourNo) {
    let d = new Date();
    d.setDate(d.getDate() + (dayNo + 7 - d.getDay()) % 7);
    d.setHours(hourNo);
    return d.getTime();
}

function getNextLectureUpdate(tree, currentDayNo, currentHourNo) {
  let minH = 999999999999;
  let endH = null;
  let endD = null
  for (let days in tree) {
      day = parseInt(days);
      for (let hour of tree[day]) {
          let dayDiff = Math.abs((day - currentDayNo) % 7);
          let hourDiff = Math.abs(hour - currentHourNo);
          dayDiff = parseInt(hourDiff / 24);
          hourDiff = hourDiff % 24;
          if (dayDiff * 24 + hourDiff < minH) {
            minH = dayDiff * 24 + hourDiff;
            endD = day;
            endH = hour;
          }
      }
  }
  return (endD != null && endH != null ) ? [endD,endH] : null;
}

function uniq(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

function toShorthand(x) {
  myName = x.split(" ");
  shorthand = "";
  for (i = 0; i < myName.length; i++)
      shorthand += myName[i].charAt(0);
  return shorthand;
}

/*
exports.cron_getCourses = functions.pubsub.topic('weekly-tick').onPublish((message) => {
    const acceptedCampuses = ["Canterbury"];
    const acceptedSchools = ["School of Computing"];
    return querySnapshot.forEach(function(doc) {
        const course = doc.data();
        var options = {
            method: 'GET',
            uri: 'https://cors-anywhere.herokuapp.com/https://api.kent.ac.uk/api/programmes/current/all/programmes/',
            headers: {
                'x-requested-with': 'https://player.kent.ac.uk',
            }
        };

        return requestPromise(options)
          .then(function(xml) {
            return xml2js(xml).then(function(courses) {
              const batch = db.batch();
              const courseCodes = [];
              for (var course of courses) {
                if (acceptedSchools.contains(course.main_school) && acceptedCampuses.contains(course.campus)) {
                  courseCodes.push(course.ucas_code);
                  let newCourseObj = {
                    name: course.name,
                    campus: course.campus,
                    school: toShorthand(course.main_school),
                  }
                }
                let constantModulesForType = db.collection("courses").doc("modules").collection("groups").doc(code);
                batch.set(constantModulesForType, moduleGroups);
              }
              return batch.commit();
            });
        });
    });
});

exports.cron_getModules = functions.pubsub.topic('weekly-tick').onPublish((message) => {
    const acceptedCodes = ["COMP"];
    return querySnapshot.forEach(function(doc) {
        const course = doc.data();
        var options = {
            method: 'GET',
            uri: 'https://cors-anywhere.herokuapp.com/https://api.kent.ac.uk/api/v1/modules/collection/all',
            headers: {
                'x-requested-with': 'https://player.kent.ac.uk',
            }
        };

        return requestPromise(options)
          .then(function(xml) {
            return xml2js(xml).then(function(moduleStack) {
              const batch = db.batch();
              for (var code of acceptedCodes) {
                var moduleGroups = {};
                for (var course of moduleStack.modules) {
                  if (course.code.indexOf(code) != -1) {
                    moduleGroups[module.sds_code] = {
                      code: module.sds_code,
                      running: module.running,
                      title: module.title,
                    }
                  }
                }
                let constantModulesForType = db.collection("constants").doc("modules").collection("groups").doc(code);
                batch.set(constantModulesForType, moduleGroups);
              }
              return batch.commit();
            });
        });
    });
});*/

exports.hourly_job = functions.pubsub.topic('hourly-tick').onPublish((message) => {
    const hour = new Date().getHours();
  
    if ((hour > 8 && hour < 18) || true) {
        const currentYear = getAchedemicYear();
        const weeksRef = db.collection("constant").doc("weeks");
      
        return weeksRef.get().then(function(doc) {
            const weeks = doc.data();
            const coursesToUpdateRef = db.collection("moduleKeys").where('year', '==', currentYear).where('nextUpdate', '<', new Date().getTime());
          
            return coursesToUpdateRef.get()
              .then(function(querySnapshot) {
              
                  return querySnapshot.forEach(function(doc) {
                      const course = doc.data();
                      var options = {
                          method: 'GET',
                          uri: 'https://cors-anywhere.herokuapp.com/http://player.kent.ac.uk/Panopto/Podcast/Podcast.ashx?courseid=' + course.hash + '&type=mp4',
                          headers: {
                              'x-requested-with': 'https://player.kent.ac.uk',
                          }
                      };

                      return requestPromise(options)
                        .then(function(xml) {
                          return xml2js(xml).then(function(json) {
                                const batch = db.batch();
                            
                                let courseRaw = json.rss.channel[0];
                                let yearStr = courseRaw.title[0].match(/(20[0-2][0-9]\/20[0-2][0-9])/)[0];
                                const year = yearStr.substr(0, yearStr.indexOf("/"));
                                const moduleID = courseRaw.title[0].match(/[A-Z]+[0-9]+/)[0];
                  
                                let weekCount = {};   
                                let lectureChecks = {};
                                const lectures = [];

                                for (let lecture of courseRaw.item) {
                                    let lectureWeek = getWeekNo(new Date(lecture.pubDate[0]));
                                    let lectureDay = getDayNo(new Date(lecture.pubDate[0]));
                                    let lectureHour = getHourNo(new Date(lecture.pubDate[0]));
                                    
                                    weekCount[lectureWeek] = (weekCount[lectureWeek]) ? weekCount[lectureWeek] + 1 : 1;
                                    if (!lectureChecks[lectureDay])
                                        lectureChecks[lectureDay] = [];
                                    lectureChecks[lectureDay].push(lectureHour);
                                    
                                    const weekCode = weeks[lectureWeek].code;
                                    const title = moduleID + " " + weekCode + numToSSColumn(weekCount[lectureWeek]);
                                    const desciption = lecture.title[0];
                                    const lectureID = moduleID + "." + currentYear + "." + weekCode + numToSSColumn(weekCount[lectureWeek]);
                                    const author = lecture["itunes:author"][0].replace("Moodle/", "").replace("Moodle", "").replace(`\\`, "");
                                    const videoURL = lecture["enclosure"][0]["$"]["url"];
                                    const videoLength = lecture["itunes:duration"][0];
                                    const duration = parseInt(lecture["itunes:duration"][0] / 60) + ":" + ("0" + parseInt(lecture["itunes:duration"][0] % 60)).slice(-2);
                                    const date = new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0]));
                                  
                                    const lectureObj = {
                                        lectureID: lectureID,
                                        title: title,
                                        description: desciption,
                                        author: author,
                                        videoURL: videoURL,
                                        videoLength: videoLength,
                                        duration: duration,
                                        date: date,
                                        moduleID: moduleID,
                                        year: currentYear,
                                        uniqueifiers: {
                                          week: lectureWeek,
                                          day: lectureDay,
                                          hour: lectureHour,
                                        }
                                    };

                                    const lectureRef = db.collection("lectures").doc(lectureID);
                                    batch.set(lectureRef, lectureObj);
                                  
                            
                                    const moduleLectureRef = db.collection("modules").doc(moduleID).collection("years").doc(currentYear.toString());
                                    batch.set(moduleLectureRef, {
                                      [lectureID]: {
                                        lectureID: lectureID,
                                        author: author,
                                        date: date,
                                        duration: duration,
                                        title: title,
                                        videoLength: videoLength,
                                        videoURL: videoURL,
                                      }
                                    }, {merge: true});
                                }
                            
                                for (var i in lectureChecks) {
                                  lectureChecks[i] = uniq(lectureChecks[i]);
                                  for (var b in lectureChecks[i])
                                    lectureChecks[i][b]++;
                                }
                                
                                keyObj = {
                                  weekCount: weekCount,
                                  lectureChecks: lectureChecks,
                                };
                                if (course.year != currentYear) {
                                    keyObj.active = false;
                                } else if (weekCount.length == 1 || lectureChecks.length == 0) {
                                    keyObj.firstWeek = true; 
                                } else if (lectureChecks.length == 0) { 
                                    keyObj.firstWeek = false; 
                                } else {
                                    let time = new Date();
                                    let tD = time.getDate();
                                    let tH = time.getHours();
                                    const dayNo = getDayNo(new Date());
                                    const hourNo = getHourNo(new Date());
                                    let datetime = getNextLectureUpdate(lectureChecks, dayNo, hourNo);
                                    time.setDate(tD + (dayNo - datetime[0]) % 7);
                                    time.setHours(tH + (hourNo - datetime[1]) % 24);
                                    keyObj.nextUpdate = time.getTime();
                                }
                                let keyRef = db.collection("moduleKeys").doc(doc.id);
                                batch.update(keyRef, keyObj);
                            
                                return batch.commit();
                              })
                              .catch(function(err) {
                                  return console.warn("Could not update ModuleHash - " + course.hash + " " + err);
                              });
                        });
                  });
              });
        });
    }
});

/*
exports.createLecture = functions.firestore.document('lectures/{lectureID}').onCreate((snap, context) => {
    const newValue = snap.data();
  console.log("moduleID"+newValue.moduleID); 
  console.log("year"+newValue.year);
    const constantLectureRef = db.collection("modules").doc(newValue.moduleID).collection("years").doc(newValue.year.toString());
  console.log("ref:"+constantLectureRef);
    return constantLectureRef.set({
      [newValue.lectureID]: {
        lectureID: newValue.lectureID,
        author: newValue.author,
        date: newValue.author,
        duration: newValue.duration,
        title: newValue.title,
        videoLength: newValue.videoLength,
        videoURL: newValue.videoURL,
      }
    }, {merge: true}).catch(e =>{
      throw new Error(e);
    });;
});

exports.updateLecture = functions.firestore.document('lectures/{lectureID}').onUpdate((change, context) => {
    const newValue = change.after.data();
    const constantLectureRef = db.collection("modules").doc(newValue.moduleID).collection("years").doc(newValue.year.toString());
    return true;
    const moduleLectureObj = {
      [newValue.lectureID]: {
        lectureID: newValue.lectureID,
        author: newValue.author,
        date: newValue.author,
        duration: newValue.duration,
        title: newValue.title,
        videoLength: newValue.videoLength,
        videoURL: newValue.videoURL,
      }
    };
    return constantLectureRef.update(moduleLectureObj).catch(e => {
      console.log(e);
    })
});

exports.deleteLecture = functions.firestore.document('lectures/{lectureID}').onDelete((snap, context) => {
    const newValue = snap.data();
    const constantLectureRef = db.collection("modules").doc(newValue.moduleID).collection("years").doc(newValue.year.toString());
    return constantLectureRef.update({
      [newValue.lectureID]: FieldValue.delete(),
    })
});
*/

exports.addSchool = functions.firestore.document('schools/{schoolID}').onCreate((snap, context) => {
    const newValue = snap.data();
    const constantSchoolsRef = db.collection("constant").doc("schools");
    return constantSchoolsRef.set({
      [newValue.id]: {
        schoolID: newValue.id,
        name: newValue.name,
      }
    })
});

exports.updateSchool = functions.firestore.document('schools/{schoolID}').onUpdate((change, context) => {
    const newValue = change.after.data();
    const constantSchoolsRef = db.collection("constant").doc("schools");
    return constantSchoolsRef.update({
      [newValue.id]: {
        schoolID: newValue.id,
        name: newValue.name,
      }
    })
});

exports.deleteSchool = functions.firestore.document('schools/{schoolID}').onDelete((snap, context) => {
    const newValue = snap.data();
    const constantSchoolsRef = db.collection("constant").doc("schools");
    return constantSchoolsRef.update({
      [newValue.id]: FieldValue.delete()
    })
});

exports.addModule = functions.firestore.document('modules/{moduleID}').onCreate((snap, context) => {
    const newValue = snap.data();
    const batch = db.batch();
  
    for (var courseID of newValue.courses) {
      let coursesRef = db.collection("courses").doc(courseID).collection("constants").modules("modules");
      batch.update(coursesRef, {
        [newValue.moduleID]: {
          moduleID: newValue.moduleID,
          name: newValue.name,
          stage: newValue.stage,
          term: newValue.term,
        },
      })
    }
  
    return batch.commit();
});

exports.updateModuleYears = functions.firestore.document('modules/{moduleID}').onUpdate((change, context) => {
    const module = change.after.data();
    const yearsRef = change.after.ref.collection("years");
  
    return yearsRef.get().then(function(querySnapshot) {
      const batch = db.batch();
      querySnapshot.forEach(function(doc) {
          let yearRef = yearsRef.doc(doc.id);
          batch.update(yearRef, {
              moduleID: module.moduleID,
              name: module.name,
              stage: module.stage,
              term: module.term,
          });
      });
      return batch.commit();
    });
});

exports.updateModule = functions.firestore.document('modules/{moduleID}/years/{yearID}').onCreate((snap, context) => {
    const moduleID = context.params.userId;
    let coursesRef = db.collection("modules").doc(moduleID);
  
    return coursesRef.get().then(doc => {
      const module = doc.data();
      
      return snap.ref.set({
        moduleID: module.moduleID,
        name: module.name,
        stage: module.stage,
        term: module.term,
        lectures: {},
      })
    })
});

exports.deleteModule = functions.firestore.document('modules/{moduleID}').onDelete((snap, context) => {
    const newValue = snap.data();
    const batch = db.batch();
  
    for (var courseID of newValue.courses) {
      let coursesRef = db.collection("courses").doc(courseID).collection("constants").modules("modules");
      batch.update(coursesRef, {
        [newValue.moduleID]:  FieldValue.delete(),
      })
    }
  
    return batch.commit();
});

exports.createCourse = functions.firestore.document('courses/{courseID}').onCreate((snap, context) => {
    const courseID = context.params.courseID;
    const course = snap.data();
    let coursesRef = db.collection("schools").doc(course.schoolID).collection("constants").doc("courses");
  
    return coursesRef.set({
      [courseID]: {
        courseID: courseID,
        name: course.name,
      },
    }, {merge: true});
});

exports.updateCourse = functions.firestore.document('courses/{courseID}').onUpdate((update, context) => {
    const courseID = context.params.courseID;
    const course = update.after.data();
    let coursesRef = db.collection("schools").doc(course.schoolID).collection("constants").doc("courses");
  
    return coursesRef.update({
      [courseID]: {
        courseID: courseID,
        name: course.name,
      },
    });
});

exports.deleteCourse = functions.firestore.document('courses/{courseID}').onDelete((snap, context) => {
    const courseID = context.params.courseID;
    const course = snap.data();
    let coursesRef = db.collection("schools").doc(course.schoolID).collection("constants").doc("courses");
  
    return coursesRef.set({
      [courseID]: FieldValue.delete(),
    });
});