# KentFlixServer
An open source elegant solution to watching Kent lecture recordings. This is the server architechure for the platform.

## Installation
Install dependencies:

	npm install
Then deploy the server locally:

	firebase deploy
    
## Useage

### Sign Up

POST: https://kentflix-7f510.firebaseapp.com/api/v1/signup

VALUES: email, password

### Login

POST: https://kentflix-7f510.firebaseapp.com/api/v1/login

VALUES: email, password

EXAMPLE RETURN:
{error: false, infoMessage: "User now signed in"}
{error: true, infoMessage: "Invalid Password"}

### Verify Account

GET: https://kentflix-7f510.firebaseapp.com/api/v1/verify/:email/:token

NOTE: Will change to not be within the API itself

### Parse course JSON to server

POST: https://kentflix-7f510.firebaseapp.com/api/v1/feed/:courseID/update

PARAMETERS: courseID would be CO320
BODY: Would be the JSON responce from the Panopto url
RETURNS: {error: true, responce: PROCESSED_JSON}

### Get infomation on course

GET: https://kentflix-7f510.firebaseapp.com/api/v1/courses/:courseID

PARAMETERS: courseID would be CO320
RETURNS: {error: true, responce: COURSE_INFOMATION}

### Get infomation on lecture within course

GET: https://kentflix-7f510.firebaseapp.com/api/v1/courses/:courseID/lectures/:lectureID

PARAMETERS: courseID would be CO320 and lectureID would be the course code on /v1/courses/:courseID api
RETURNS: {error: true, responce: LECTURE_INFOMATION}

### Get schools

GET: https://kentflix-7f510.firebaseapp.com/api/v1/schools

RETURNS: {error: true, responce: COURSE_INFOMATION}

### Add school

POST: https://kentflix-7f510.firebaseapp.com/api/v1/schools/:schoolID/:schoolName
PARAMETERS: schoolID would be short hand for the school (SoC) and schoolName would be the name of the school (School of Computing)
RETURNS: {error: false, infoMessage: "School Created"}