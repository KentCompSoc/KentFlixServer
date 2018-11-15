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

function getCurrentYear() {
  let yearDate = new Date();
  yearDate.setDate(yearDate.getDate() + 100);
  return yearDate.getFullYear() - 1;
}

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(re.test(email)){
    if(email.indexOf("@kent.ac.uk", email.length - "@kent.ac.uk".length) !== -1){
        return true;
    }
  }
  return false;
}

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
            return sendError(res, 500, "Failed to create user");
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

app.get('/:sessionID', sessionChecker, (req, res) => {
  const courseID = req.params.courseID;
  return sendSuccess(res, {
    sessionID: courseID
  });
});

// SCHOOLS //

app.get('/:sessionID/schools', sessionChecker, (req, res) => {
  const schoolRef = db.collection("schools");
  
  return schoolRef.get().then(function(querySnapshot) {
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

// COURSES //

app.get('/:sessionID/schools/:schoolID/courses', sessionChecker, (req, res) => {
  const coursesRef = db.collection("courses");
  
  return coursesRef.get().then(function(querySnapshot) {
    var returnArr = [];
    querySnapshot.forEach(function(doc) {
        returnArr.push(doc.data());
    });
    return returnArr;
  }).then(function(course) {
    return sendSuccess(res, course);
  }).catch(error =>{
    return sendError(res, 400, "Failed to get courses");
  });
});

app.post('/:sessionID/courses/add', sessionChecker, (req, res) => {
  const values = req.body;
  const courseID = values.courseID;
  const courseName = values.courseName;
  const courseSchool = values.courseSchool;
  const batch = db.batch();
  
  const courseRef = db.collection("courses").doc(courseID);
  batch.set(courseRef, {
    id: courseID,
    name: courseName,
    schools: courseSchool,
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

app.get('/:sessionID/courses/:courseID/modules', sessionChecker, (req, res) => {
  const courseID = req.params.courseID;
  const moduleRef = db.collection("courses").doc(courseID).collection("constants").doc("modules");
  
  return moduleRef.get().then(function(doc) {
    return sendSuccess(res, doc.data());
  }).catch(error =>{
    return sendError(res, 400, "Failed to get modules");
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
  const moduleRef = db.collection("modules").doc(moduleID).collection("years").doc(getCurrentYear().toString());
  
  return moduleRef.get().then(doc => {
    if (!doc.exists) {
      return sendError(res, 400, "Module hasn't been updated for this year");
    } else return sendSuccess(res, doc.data());
  }).catch(a =>{
    return sendError(res, 400, "Failed to get module");
  });
});

app.get('/:sessionID/modules/:moduleID/:year', sessionChecker, (req, res) => {  
  const moduleID = req.params.moduleID;
  const year = req.params.year;
  const moduleRef = db.collection("modules").doc(moduleID).collection("years").doc(year);
  
  return moduleRef.get().then(doc => {
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
    return sendSuccess(res, doc.data());
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
  const period = values.period;
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
    period: period,
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


exports.createLecture = functions.firestore.document('lectures/{lectureID}').onCreate((snap, context) => {
  const lectureID = context.params.lectureID;
  const newValue = snap.data();

  const lecturesRef = db.collection("modules").doc(newValue.moduleID).collection("years").doc(newValue.year);
  return lecturesRef.set({
    [newValue.title]: {
      title: newValue.title,
      author: newValue.author,
      videoURL: newValue.videoURL,
      videoLength: newValue.videoLength,
      duration: newValue.duration,
      date: newValue.date,
      moduleID: newValue.moduleID,
      year: newValue.year,
      lectureID: newValue.lectureID,
    }
  });
  
  return batch.commit();
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
  
  if (newValue.courses != previousValue.courses) {
    const allCourses = newValue.courses.concat(previousValue.courses);
    let newContains, oldContains;
    const courseModulesObj = {}
    
    for (let courseID of allCourses) {
      newContains = newValue.courses.indexOf(courseID) > -1;
      oldContains = previousValue.courses.indexOf(courseID) > -1;
      const courseModulesRef = db.collection("courses").doc(courseID).collection("constants").doc("modules");
      
      if (newContains) {
        batch.set(courseModulesRef, {
          [previousValue.moduleID]: {
            moduleID: previousValue.moduleID,
            name: previousValue.name,
            stage: previousValue.stage,
            term: previousValue.term,
          },
        }, {merge: true});
      } else if (oldContains) {
        batch.update(courseModulesRef, {
          [previousValue.moduleID]: FieldValue.delete(),
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

exports.hourly_job = functions.pubsub.topic('hourly-tick').onPublish((message) => {
  const hour = new Date().getHours();
  if ((hour > 8 && hour < 18) || true) {
      var yearDate = new Date();
      yearDate.setDate(yearDate.getDate() + 100);
      const currentYear = yearDate.getFullYear();
      const weeksRef = db.collection("constant").doc("weeks");
      return weeksRef.get()
        .then(function(doc) {
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

                      function roundMinutes(date) {
                        date.setHours(date.getHours() + Math.round(date.getMinutes() / 60) - 1);
                        date.setMinutes(0);
                        return date.getHours() + ":" + ('00' + date.getMinutes()).slice(-2);
                      }
                      const lectures = [];

                      let lectureTimes = [];
                      let weeksCount = {};
                      for (var lectureNo in courseRaw.item) {
                        let lecture = courseRaw.item[lectureNo];
                        let title = lecture.title[0].replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)+(.*)+(AM|PM|am|pm)/, '');
                        if (title.length == 0)
                            title = courseRaw.title[0] + " " + new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0]));
                        const currentdate = new Date();
                        var lectureID = currentdate.getDate() + "-" +
                            (currentdate.getMonth() + 1) + "-" +
                            currentdate.getFullYear() + "@" +
                            currentdate.getHours() + ":" +
                            currentdate.getMinutes();
                        lectureTimes.add(startOfLectureDate);
                        lectureTimes.add(startOfLectureDate + 1);
                        let weekNo = new Date(lecture.pubDate[0]).getTime()/(1000*60*60*24);
                        if (weeksCount[weekNo]) {
                          weeksCount[weekNo]++;
                        } else {
                          weeksCount[weekNo] = 1;
                        }
                        
                        const lectureObj = {
                            title: title,
                            author: lecture["itunes:author"][0].replace("Moodle/", "").replace("Moodle", "").replace(`\\`, ""),
                            videoURL: lecture["enclosure"][0]["$"]["url"],
                            videoLength: lecture["itunes:duration"][0],
                            duration: parseInt(lecture["itunes:duration"][0] / 60) + ":" + ("0" + parseInt(lecture["itunes:duration"][0] % 60)).slice(-2),
                            date: new Date(lecture.pubDate[0]).toDateString() + " " + roundMinutes(new Date(lecture.pubDate[0])),
                            moduleID: moduleID,
                            year: year,
                            lectureID: lectureID,
                        };

                        lectureRef = db.collection("modules").doc(moduleID).collection(year).doc(courseID + "." + lectureID);
                        batch.set(lectureRef, {
                            ["lecturesWeeksCount." + week]: {
                                ["lectures." + title]: {
                                    lectureObj,
                                }
                            }
                        });
                      }

                      let keyRef = db.collection("moduleKeys").doc(doc.id);
                      let time = new Date();
                      time = time.setHours(time.getHours() + 3);
                      batch.update(keyRef, {
                          nextUpdate: new Date().getTime() + (1000 * 60 * 60 * 5),
                      });
                      return batch.commit();
                    })
                  .catch(function(err) {
                        return console.warn("Could not update CourseHash - " + course.hash + " " + err);
                    });
              });
          });
        });
      });
  }
});