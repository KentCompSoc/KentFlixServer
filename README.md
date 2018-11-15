# KentFlixServer
An open source elegant solution to watching Kent lecture recordings. This is the server architechure for the platform.

## Installation
Install dependencies:

	npm install
Then deploy the server locally:

	firebase deploy
    
## Cron Jobs Engine

[See documentation](../appengine/README.md)

## Endpoints

#### Auth

- **[<code>POST</code> /signup](#sign-up)**
- **[<code>POST</code> /login](#login)**
- **[<code>GET</code> /verify/:email/:token](#verify-account)**

#### User

- **[<code>GET</code> /:sessionID](#get-session)**

#### Schools

- **[<code>GET</code> /:sessionID/schools](#get-schools)**
- **[<code>POST</code> /:sessionID/schools/add](#add-school)**

#### Courses

- **[<code>GET</code> /:sessionID/schools/:schoolID/courses](get-courses)**
- **[<code>GET</code> /:sessionID/courses/:courseID](get-course)**
- **[<code>GET</code> /:sessionID/courses/:courseID/:year/lectures](get-lectures)**
- **[<code>GET</code> /:sessionID/lectures/:lectureID](get-lecture)**


## Usage

### Sign Up

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/signup

BODY: email, password

### Login

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/login

BODY: email, password

EXAMPLE RETURN:
{error: false, infoMessage: "User now signed in"}
{error: true, infoMessage: "Invalid Password"}

### Verify Account

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/verify/:email/:token

NOTE: Will change to not be within the API itself


### Get Session

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get Schools 

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/schools

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Add School

<code>POST</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/schools/add

BODY: schoolID would be short hand for the school (SoC) and schoolName would be the name of the school (School of Computing)

RETURNS: {error: false, infoMessage: "School Created"}

### Get Courses

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/schools/:schoolID/courses

PARAMETERS: schoolID would be SoC

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get Course

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/courses/:courseID

PARAMETERS: courseID would be CO320

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get Lectures

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/courses/:courseID/:year/lectures

PARAMETERS: courseID would be CO320, year would be 2017 or 2018

RETURNS: {error: false, responce: COURSE_INFOMATION}

### Get Lecture

<code>GET</code> https://kentflix-7f510.firebaseapp.com/api/v1/:sessionID/lectures/:lectureID

PARAMETERS: lectureID would be the lecture hash from [Get Lectures](#get-lectures)

RETURNS: {error: false, responce: LECTURE_INFOMATION}