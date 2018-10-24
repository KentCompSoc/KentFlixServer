# KentFlixServer
An open source elegant solution to watching Kent lecture recordings. This is the server architechure for the platform.

## Installation
Install dependencies:

	npm install
Then deploy the server locally:

	firebase deploy
    
## Endpoints

#### Auth

- **[<code>POST</code> /signup](#sign-up)**
- **[<code>POST</code> /login](#login)**
- **[<code>GET</code> /verify/:email/:token](#verify-account)**

#### Schools

- **[<code>GET</code> /:sessionID/schools](#get-schools)**
- **[<code>POST</code> /:sessionID/schools/:schoolID/:schoolName](#add-school)**

#### Courses

- **[<code>POST</code> /:sessionID/feed/:courseID/update](#update-course-content)**
- **[<code>GET</code> /:sessionID/courses/:courseID](get-course)**
- **[<code>GET</code> /:sessionID/courses/:courseID/lectures/:lectureID](get-lecture)**


## Usage

### Sign Up

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/signup

VALUES: email, password

### Login

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/login

VALUES: email, password

EXAMPLE RETURN:
{error: false, infoMessage: "User now signed in"}
{error: true, infoMessage: "Invalid Password"}

### Verify Account

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/verify/:email/:token

NOTE: Will change to not be within the API itself

### Get schools 

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/schools

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Add school

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/schools/:schoolID/:schoolName

PARAMETERS: schoolID would be short hand for the school (SoC) and schoolName would be the name of the school (School of Computing)

RETURNS: {error: false, infoMessage: "School Created"}

### Update course content

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/feed/:courseID/update

PARAMETERS: courseID would be CO320

BODY: Would be the JSON responce from the Panopto url

RETURNS: {error: false, responce: PROCESSED_JSON}

### Get course

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/courses/:courseID

PARAMETERS: courseID would be CO320

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get lecture

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/courses/:courseID/lectures/:lectureID

PARAMETERS: courseID would be CO320 and lectureID would be the course code on /v1/courses/:courseID api

RETURNS: {error: false, responce: LECTURE_INFOMATION}